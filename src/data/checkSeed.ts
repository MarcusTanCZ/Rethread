// Internal consistency checks for the seed. Run by `npm run check:seed` and by the unit tests.
import type { DomainData, SampleSignal } from '../types';
import { DEMO_DATE, datePart } from '../lib/clock';
import { portfolioMetrics } from '../lib/metrics';
import { formatSGD } from '../lib/format';
import { visibleDecisions } from '../state/selectors';

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const TARGET_VALUE_AT_RISK = 4_300_000;
const VALUE_TOLERANCE = 0.05;
// Covers emoji and pictographs, which SPEC forbids anywhere in the interface.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

export function checkSeed(data: DomainData, samples: SampleSignal[]): CheckResult[] {
  const results: CheckResult[] = [];
  const check = (name: string, problems: string[], okDetail: string) =>
    results.push({ name, ok: problems.length === 0, detail: problems.length ? problems.join('; ') : okDetail });

  const decisions = Object.values(data.decisions);
  const assumptions = Object.values(data.assumptions);
  const options = Object.values(data.rejectedOptions);
  const evidence = Object.values(data.evidence);
  const users = Object.values(data.users);

  // Counts
  const counts = {
    users: [users.length, 3],
    decisions: [decisions.length, 12],
    assumptions: [assumptions.length, 34],
    'rejected options': [options.length, 18],
    'evidence items': [evidence.length, 9],
    'sample signals': [samples.length, 6],
  } as const;
  check(
    'Entity counts match SPEC',
    Object.entries(counts).filter(([, [got, want]]) => got !== want).map(([k, [got, want]]) => `${k}: ${got}, expected ${want}`),
    Object.entries(counts).map(([k, [got]]) => `${got} ${k}`).join(', '),
  );

  // Record keys match ids
  const keyProblems: string[] = [];
  for (const [label, rec] of Object.entries({
    users: data.users, decisions: data.decisions, assumptions: data.assumptions,
    rejectedOptions: data.rejectedOptions, evidence: data.evidence,
  })) {
    for (const [k, v] of Object.entries(rec)) if (k !== (v as { id: string }).id) keyProblems.push(`${label}[${k}] has id ${(v as { id: string }).id}`);
  }
  check('Record keys equal ids', keyProblems, 'all keys match');

  // Decision -> assumption references
  const refProblems: string[] = [];
  const claimed = new Map<string, string>();
  for (const d of decisions) {
    for (const id of d.assumptionIds) {
      const a = data.assumptions[id];
      if (!a) refProblems.push(`${d.id} references missing ${id}`);
      else if (a.decisionId !== d.id) refProblems.push(`${d.id} lists ${id}, which belongs to ${a.decisionId}`);
      if (claimed.has(id)) refProblems.push(`${id} listed by both ${claimed.get(id)} and ${d.id}`);
      claimed.set(id, d.id);
    }
  }
  for (const a of assumptions) if (!claimed.has(a.id)) refProblems.push(`${a.id} is not listed by any decision`);
  check('Every assumptionId on a decision exists and belongs to it', refProblems, `${claimed.size} references resolved, no orphans`);

  // Decision -> rejected option references
  const optProblems: string[] = [];
  const optClaimed = new Set<string>();
  for (const d of decisions) {
    for (const id of d.rejectedOptionIds) {
      const o = data.rejectedOptions[id];
      if (!o) optProblems.push(`${d.id} references missing ${id}`);
      else if (o.decisionId !== d.id) optProblems.push(`${d.id} lists ${id}, which belongs to ${o.decisionId}`);
      optClaimed.add(id);
    }
  }
  for (const o of options) if (!optClaimed.has(o.id)) optProblems.push(`${o.id} is not listed by any decision`);
  check('Every rejectedOptionId on a decision exists and belongs to it', optProblems, `${optClaimed.size} references resolved, no orphans`);

  // rejectedBecauseAssumptionId -> real assumption on the same decision
  const killProblems: string[] = [];
  let linked = 0;
  for (const o of options) {
    if (o.rejectedBecauseAssumptionId === null) {
      if (o.comparableValue !== null) killProblems.push(`${o.id} has a comparableValue but no killing assumption`);
      continue;
    }
    linked += 1;
    const a = data.assumptions[o.rejectedBecauseAssumptionId];
    if (!a) killProblems.push(`${o.id} points to missing ${o.rejectedBecauseAssumptionId}`);
    else if (a.decisionId !== o.decisionId) killProblems.push(`${o.id} (${o.decisionId}) points to ${a.id} on ${a.decisionId}`);
    else if (a.test.kind === 'threshold' && o.comparableValue === null) killProblems.push(`${o.id} is killed by threshold ${a.id} but has no comparableValue`);
    else if (a.test.kind === 'condition' && o.comparableValue !== null) killProblems.push(`${o.id} is killed by condition ${a.id} but has a comparableValue`);
  }
  check(
    'Every rejectedBecauseAssumptionId points to a real assumption on the same decision',
    killProblems,
    `${linked} linked, ${options.length - linked} not tied to an assumption`,
  );

  // Evidence references
  const evProblems: string[] = [];
  for (const e of evidence) {
    for (const f of e.findings) if (!data.assumptions[f.assumptionId]) evProblems.push(`${e.id} finding on missing ${f.assumptionId}`);
    if (!data.users[e.submittedBy]) evProblems.push(`${e.id} submitted by unknown ${e.submittedBy}`);
    if (e.receivedOn > DEMO_DATE) evProblems.push(`${e.id} is dated after the demo date`);
  }
  for (const d of decisions) for (const id of d.evidenceIds) if (!data.evidence[id]) evProblems.push(`${d.id} references missing ${id}`);
  for (const a of assumptions) for (const id of a.evidenceIds) if (!data.evidence[id]) evProblems.push(`${a.id} references missing ${id}`);
  check('Evidence, findings and links resolve', evProblems, `${evidence.reduce((n, e) => n + e.findings.length, 0)} findings resolved`);

  // Users on decisions
  const userProblems: string[] = [];
  for (const d of decisions) {
    if (!data.users[d.owner]) userProblems.push(`${d.id} owner ${d.owner} missing`);
    for (const s of d.stakeholders) if (!data.users[s]) userProblems.push(`${d.id} stakeholder ${s} missing`);
    if (d.stakeholders.includes(d.owner)) userProblems.push(`${d.id} lists its owner as a stakeholder`);
  }
  check('Owners and stakeholders are real users', userProblems, 'all resolve');

  // Portfolio value
  const total = decisions.reduce((s, d) => s + d.valueAtRisk, 0);
  const off = Math.abs(total - TARGET_VALUE_AT_RISK) / TARGET_VALUE_AT_RISK;
  check(
    'Portfolio value at risk is about SGD 4.3 million',
    off <= VALUE_TOLERANCE ? [] : [`total ${formatSGD(total)} is ${(off * 100).toFixed(1)} percent from target`],
    `${formatSGD(total)} (${(off * 100).toFixed(1)} percent from SGD 4,300,000)`,
  );

  // Status coherence
  const statusProblems: string[] = [];
  const watch = decisions.filter((d) => d.status === 'watch');
  if (watch.length !== 2) statusProblems.push(`${watch.length} decisions on watch, expected 2`);
  for (const d of decisions) {
    const states = d.assumptionIds.map((id) => data.assumptions[id]?.status);
    if (d.status === 'watch' && !states.includes('shaky')) statusProblems.push(`${d.id} on watch with no shaky assumption`);
    if (d.status === 'active' && states.some((s) => s !== 'holding')) statusProblems.push(`${d.id} active with a non holding assumption`);
    if (states.includes('broken')) statusProblems.push(`${d.id} starts with a broken assumption`);
  }
  check('Statuses are coherent (2 on watch, no broken at start)', statusProblems, `on watch: ${watch.map((d) => d.id).join(', ')}`);

  // History chains end in the current status
  const histProblems: string[] = [];
  for (const d of decisions) {
    const h = [...d.historyEntries].sort((a, b) => a.at.localeCompare(b.at));
    if (h[0]?.kind !== 'created') histProblems.push(`${d.id} history does not start with created`);
    if (h[0] && datePart(h[0].at) !== d.decidedOn) histProblems.push(`${d.id} created entry is not on decidedOn`);
    let status = h[0]?.toStatus;
    for (const e of h.slice(1)) {
      if (e.kind !== 'status-change') continue;
      if (e.fromStatus !== status) histProblems.push(`${d.id} ${e.id} moves from ${e.fromStatus} but status was ${status}`);
      status = e.toStatus;
    }
    if (status !== d.status) histProblems.push(`${d.id} history ends at ${status}, record says ${d.status}`);
    if (h.some((e) => datePart(e.at) > DEMO_DATE)) histProblems.push(`${d.id} has history after the demo date`);
  }
  check('History logs replay to each current status', histProblems, 'all 12 replay cleanly');

  // Dashboard metrics start non empty
  const m = portfolioMetrics(visibleDecisions(data, users.find((u) => u.role === 'executive')));
  check(
    'Dashboard metrics have seeded values',
    [
      ...(m.medianDaysBreakToReopen === null ? ['no break to reopen pairs'] : []),
      ...(m.brokenLast30Days === 0 ? ['no breaks in the last 30 days'] : []),
    ],
    `active ${m.active}, watch ${m.watch}, reopen ${m.reopen}, broken last 30 days ${m.brokenLast30Days}, median break to reopen ${m.medianDaysBreakToReopen} days`,
  );

  // Hero decision
  const d7 = data.decisions['D-07'];
  const heroProblems: string[] = [];
  if (!d7) heroProblems.push('D-07 missing');
  else {
    if (d7.title !== 'Single source cold chain with FrostLink, three year term') heroProblems.push('title differs');
    if (d7.decidedOn !== '2026-03-12') heroProblems.push('decidedOn differs');
    if (d7.reviewDate !== '2026-11-01') heroProblems.push('reviewDate differs');
    if (d7.valueAtRisk !== 1_240_000) heroProblems.push('valueAtRisk differs');
    if (data.users[d7.owner]?.name !== 'Joanne Lim') heroProblems.push('owner is not Joanne Lim');
    if (d7.status !== 'active') heroProblems.push('D-07 does not start active');
    if (d7.assumptionIds.join() !== 'A-104,A-105,A-106') heroProblems.push('assumptions are not A-104..A-106');
    const notify = [d7.owner, ...d7.stakeholders].map((id) => data.users[id]?.name).sort();
    if (notify.join() !== 'Joanne Lim,Priya Raman') heroProblems.push(`notify list would be ${notify.join(', ')}`);
    const a104 = data.assumptions['A-104'];
    if (a104?.test.kind !== 'threshold' || a104.test.value !== 42 || a104.test.operator !== '<=' || a104.criticality !== 'critical')
      heroProblems.push('A-104 is not a critical <= 42 threshold');
    const a105 = data.assumptions['A-105'];
    if (a105?.test.kind !== 'condition' || !['certification lapsed', 'suspended', 'withdrawn', 'revoked'].every((k) => a105.test.kind === 'condition' && a105.test.negativeKeywords.includes(k)))
      heroProblems.push('A-105 negative keywords differ');
    const a106 = data.assumptions['A-106'];
    if (a106?.test.kind !== 'threshold' || a106.test.value !== 800 || a106.criticality !== 'supporting') heroProblems.push('A-106 differs');
    const ro11 = data.rejectedOptions['RO-11'];
    if (ro11?.rejectedBecauseAssumptionId !== 'A-104' || ro11.comparableValue !== 45) heroProblems.push('RO-11 not killed by A-104 at 45');
    const ro12 = data.rejectedOptions['RO-12'];
    if (ro12?.rejectedBecauseAssumptionId !== null) heroProblems.push('RO-12 should not be tied to an assumption');
    if (42 * 1.19 <= 45) heroProblems.push('a 19 percent rise would not make RO-11 favourable');
  }
  check('Hero decision D-07 matches SPEC', heroProblems, 'D-07, A-104..A-106, RO-11 (45.00) and RO-12 as specified; notify = Joanne Lim, Priya Raman');

  // Contributor coverage
  const daniel = users.find((u) => u.role === 'contributor');
  const danielSees = daniel ? decisions.filter((d) => d.stakeholders.includes(daniel.id)).map((d) => d.id) : [];
  check(
    'Contributor has a stakeholder list that excludes D-07',
    [...(danielSees.length === 0 ? ['contributor sees nothing'] : []), ...(danielSees.includes('D-07') ? ['contributor can see D-07'] : [])],
    `Daniel Tan sees ${danielSees.join(', ')}`,
  );

  // Samples
  const sampleProblems: string[] = [];
  const hero = samples.find((s) => s.key === 'frostlink-rate-notice');
  if (!hero) sampleProblems.push('FrostLink sample missing');
  else if (!/increase by 19\s+percent/.test(hero.body)) sampleProblems.push('FrostLink sample lacks the 19 percent rise');
  if (samples.filter((s) => s.expectation === 'shaky').length !== 1) sampleProblems.push('need exactly one shaky sample');
  if (samples.filter((s) => s.expectation === 'irrelevant').length !== 1) sampleProblems.push('need exactly one irrelevant sample');
  if (new Set(samples.map((s) => s.key)).size !== samples.length) sampleProblems.push('duplicate sample keys');
  check('Six samples include hero, shaky and irrelevant', sampleProblems, samples.map((s) => `${s.label} (${s.expectation})`).join(', '));

  // No emoji
  const blob = JSON.stringify({ data, samples });
  check('No emoji in seed text', EMOJI.test(blob) ? ['emoji found'] : [], 'none found');

  return results;
}
