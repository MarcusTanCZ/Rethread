// Agent pipeline: runs the engine, applies findings to assumptions, derives decision status changes, checks revivability, drafts briefs, and emits the full 8 step trace.
//
// runAgent() is side effect free: it returns an AgentRunResult describing every change.
// applyRun() folds that result into the domain data, so the reducer stays a one liner and the
// UI can animate the trace before committing anything.
import type {
  AgentRunResult,
  Assumption,
  AssumptionChange,
  AssumptionStatus,
  ConfidenceThresholds,
  DecisionChange,
  DecisionId,
  DomainData,
  Evidence,
  EvidenceDraft,
  Finding,
  HistoryEntry,
  ReopenBrief,
  ReasoningEngine,
  TraceSink,
  TraceStep,
  UserId,
} from '../types';
import { nowISO, today } from '../lib/clock';
import { formatConfidence } from '../lib/format';
import { nextId } from '../lib/ids';
import { composeBrief } from './brief';
import { extractClaims } from './extract';
import { FallbackEngine } from './fallback';
import { evaluateRevival, type RevivalResult } from './revival';
import { nextAssumptionStatus, nextDecisionStatus } from './rules';

const LIVE = new Set(['active', 'watch', 'reopen']);

export interface RunInput {
  data: DomainData;
  draft: EvidenceDraft;
  submittedBy: UserId;
  engine: ReasoningEngine;
  thresholds: ConfidenceThresholds;
  /** Receives each trace step as it is produced. The full list is also on the result. */
  onTrace?: TraceSink;
}

/** Keeps only well formed findings on known assumptions, one per assumption, in id order. */
function sanitise(findings: Finding[], known: Map<string, Assumption>): Finding[] {
  const seen = new Set<string>();
  return findings
    .filter((f) => known.has(f.assumptionId) && !seen.has(f.assumptionId) && seen.add(f.assumptionId))
    .map((f) => ({ ...f, confidence: Math.min(1, Math.max(0, Number(f.confidence) || 0)) }))
    .sort((a, b) => a.assumptionId.localeCompare(b.assumptionId));
}

export async function runAgent(input: RunInput): Promise<AgentRunResult> {
  const { data, draft, submittedBy, engine, thresholds } = input;
  const trace: TraceStep[] = [];
  const emit = (s: TraceStep) => {
    trace.push(s);
    input.onTrace?.(s);
  };

  const evidence: Evidence = { ...draft, id: nextId('E', Object.keys(data.evidence)), submittedBy, findings: [] };
  const live = Object.values(data.assumptions).filter((a) => LIVE.has(data.decisions[a.decisionId]?.status ?? ''));
  const known = new Map(live.map((a) => [a.id, a]));

  const raw = await engine.analyse(evidence, live, emit);
  const fellBack = engine instanceof FallbackEngine && engine.lastFellBack;
  const findings = sanitise(raw, known);
  evidence.findings = findings;
  evidence.analysis = { engine: fellBack ? 'local' : engine.kind, fellBack, analysedOn: nowISO() };

  const empty: AgentRunResult = {
    evidence, trace, assumptionChanges: [], decisionChanges: [], revivedOptionIds: [], briefs: [],
    engineUsed: evidence.analysis.engine, fellBack,
  };

  if (!findings.length) {
    emit({
      kind: 'noop',
      title: 'No findings',
      lines: ['Nothing in this signal bears on a tracked assumption.', 'No assumptions or decisions changed.'],
      tone: 'ok',
    });
    return empty;
  }

  /* -- 5. verdicts ------------------------------------------------------------ */
  const post = new Map<string, Assumption>();
  const assumptionChanges: AssumptionChange[] = [];
  for (const f of findings) {
    const a = known.get(f.assumptionId)!;
    const to = nextAssumptionStatus(a, f, thresholds);
    const title = to ? `Verdict: ${to}, confidence ${formatConfidence(f.confidence)}` : `Verdict: no change, confidence ${formatConfidence(f.confidence)}`;
    const lines = [to && to !== a.status ? `${a.id} ${a.status} becomes ${to}` : `${a.id} stays ${a.status}`, f.rationale];
    emit({ kind: 'verdict', title, lines, tone: to === 'broken' ? 'alert' : to === 'shaky' ? 'warn' : to === 'holding' ? 'ok' : 'info', assumptionId: a.id, decisionId: a.decisionId });
    if (!to) continue;
    // Recorded even when the status is unchanged, so confidence and current value refresh.
    assumptionChanges.push({ assumptionId: a.id, from: a.status, to, confidence: f.confidence, ...(f.extractedValue !== undefined ? { currentValue: f.extractedValue } : {}) });
    post.set(a.id, { ...a, status: to, confidence: f.confidence, ...(f.extractedValue !== undefined ? { currentValue: f.extractedValue } : {}) });
  }
  const stateOf = (id: string): Assumption => post.get(id) ?? data.assumptions[id]!;

  /* -- 6. decision status ----------------------------------------------------- */
  const touched = [...new Set(findings.map((f) => known.get(f.assumptionId)!.decisionId))].sort();
  const decisionChanges: DecisionChange[] = [];
  for (const id of touched) {
    const d = data.decisions[id]!;
    const to = nextDecisionStatus(d.status, d.assumptionIds.map(stateOf));
    if (to !== d.status) decisionChanges.push({ decisionId: id, from: d.status, to });
  }
  if (decisionChanges.length === 1) {
    const c = decisionChanges[0]!;
    emit({ kind: 'status', title: `Decision ${c.decisionId} status: ${c.from} becomes ${c.to}`, lines: [data.decisions[c.decisionId]!.title],
      tone: c.to === 'reopen' ? 'alert' : c.to === 'watch' ? 'warn' : 'ok', decisionId: c.decisionId });
  } else if (decisionChanges.length > 1) {
    emit({ kind: 'status', title: `${decisionChanges.length} decision status changes`, lines: decisionChanges.map((c) => `${c.decisionId}: ${c.from} becomes ${c.to}`),
      tone: decisionChanges.some((c) => c.to === 'reopen') ? 'alert' : 'warn' });
  } else {
    emit({ kind: 'status', title: 'Decision status: no change', lines: touched.map((id) => `${id} stays ${data.decisions[id]!.status}`), tone: 'ok' });
  }

  /* -- 7. revivability -------------------------------------------------------- */
  const newlyBroken = new Set(assumptionChanges.filter((c) => c.to === 'broken' && c.from !== 'broken').map((c) => c.assumptionId));
  const reopened: DecisionId[] = touched.filter((id) => {
    const final = decisionChanges.find((c) => c.decisionId === id)?.to ?? data.decisions[id]!.status;
    return final === 'reopen' && data.decisions[id]!.assumptionIds.some((a) => newlyBroken.has(a));
  });
  const revivals = new Map<DecisionId, RevivalResult[]>();
  for (const id of reopened) {
    revivals.set(id, data.decisions[id]!.rejectedOptionIds.map((oid) => {
      const o = data.rejectedOptions[oid]!;
      const killer = o.rejectedBecauseAssumptionId ? stateOf(o.rejectedBecauseAssumptionId) : undefined;
      const incumbent = killer ? (findings.find((f) => f.assumptionId === killer.id)?.extractedValue ?? killer.currentValue) : undefined;
      return evaluateRevival(o, killer, incumbent);
    }));
  }
  const allRevivals = [...revivals.values()].flat();
  const revivedOptionIds = allRevivals.filter((r) => r.revivable).map((r) => r.optionId);
  if (reopened.length) {
    const n = allRevivals.length;
    const r = revivedOptionIds.length;
    emit({
      kind: 'revive',
      title: `Checking rejected options for revivability: ${r} of ${n} option${n === 1 ? '' : 's'} ${r === 1 ? 'is' : 'are'} now favourable`,
      lines: allRevivals.map((x) => {
        const o = data.rejectedOptions[x.optionId]!;
        return x.revivable
          ? `${o.id} "${o.title}": live again${x.comparison ? `, ${x.comparison.text}` : ''}`
          : `${o.id} "${o.title}": stays closed. ${x.reason}`;
      }),
      tone: r ? 'ok' : 'info',
    });
  } else {
    emit({ kind: 'revive', title: 'Checking rejected options for revivability: no decision reopened', lines: ['Rejected options are only rechecked when a decision reopens.'], tone: 'info' });
  }

  /* -- 8. briefs -------------------------------------------------------------- */
  const briefs: ReopenBrief[] = [];
  const claims = reopened.length ? extractClaims(evidence.body, Number(evidence.receivedOn.slice(0, 4))).claims : [];
  for (const id of reopened) {
    const d = data.decisions[id]!;
    briefs.push(composeBrief({
      id: nextId('RB', [...Object.keys(data.briefs), ...briefs.map((b) => b.id)]),
      createdOn: nowISO(),
      decision: d,
      evidence,
      claims,
      assumptions: d.assumptionIds.map(stateOf),
      changes: assumptionChanges.filter((c) => d.assumptionIds.includes(c.assumptionId) && c.from !== c.to),
      revivals: revivals.get(id) ?? [],
      options: data.rejectedOptions,
      users: data.users,
      relatedDecisionIds: reopened.filter((x) => x !== id),
    }));
  }
  if (briefs.length) {
    emit({
      kind: 'draft',
      title: 'Drafting reopen brief and notify list',
      lines: briefs.flatMap((b) => [
        `${b.id} for ${b.decisionId}: ${data.decisions[b.decisionId]!.title}`,
        `Notify: ${b.notifyList.map((u) => data.users[u]?.name ?? u).join(', ')}`,
        `Next step: ${b.recommendedNextStep}`,
      ]),
      tone: 'alert',
    });
  } else {
    emit({ kind: 'draft', title: 'Drafting reopen brief: not needed', lines: ['No decision reopened, so no brief was drafted.'], tone: 'info' });
  }

  return { ...empty, assumptionChanges, decisionChanges, revivedOptionIds, briefs };
}

/* ------------------------------------------------------------------ apply */

const CHANGE_VERB: Record<AssumptionStatus, string> = { broken: 'broken by', shaky: 'shaky after', holding: 'restored by' };

/** Folds a run into the domain data. Pure: returns new data and leaves the input untouched. */
export function applyRun(input: DomainData, run: AgentRunResult): DomainData {
  const data = structuredClone(input);
  const ev = run.evidence;
  const at = nowISO();
  const historyIds = Object.values(data.decisions).flatMap((d) => d.historyEntries.map((h) => h.id));
  const log = (decisionId: DecisionId, entry: Omit<HistoryEntry, 'id' | 'at'>) => {
    const id = nextId('H', historyIds, 3);
    historyIds.push(id);
    data.decisions[decisionId]!.historyEntries.push({ id, at, ...entry });
  };

  data.evidence[ev.id] = structuredClone(ev);

  for (const f of ev.findings) {
    const a = data.assumptions[f.assumptionId];
    if (!a) continue;
    if (!a.evidenceIds.includes(ev.id)) a.evidenceIds.push(ev.id);
    a.lastTestedOn = today();
    const d = data.decisions[a.decisionId]!;
    if (!d.evidenceIds.includes(ev.id)) d.evidenceIds.push(ev.id);
  }

  for (const c of run.assumptionChanges) {
    const a = data.assumptions[c.assumptionId]!;
    a.status = c.to;
    a.confidence = c.confidence;
    if (c.currentValue !== undefined) a.currentValue = c.currentValue;
    if (c.from !== c.to) {
      log(a.decisionId, {
        kind: 'assumption-change', actorId: null, assumptionId: a.id, fromAssumptionStatus: c.from, toAssumptionStatus: c.to, evidenceId: ev.id,
        cause: `${a.id} ${CHANGE_VERB[c.to]} ${ev.id} (${ev.title})`,
      });
    }
  }

  for (const c of run.decisionChanges) {
    const d = data.decisions[c.decisionId]!;
    d.status = c.to;
    const ids = run.assumptionChanges.filter((x) => d.assumptionIds.includes(x.assumptionId) && x.from !== x.to && x.to === (c.to === 'reopen' ? 'broken' : 'shaky')).map((x) => x.assumptionId);
    const cause =
      c.to === 'reopen' ? `Reopened by the agent: ${ids.join(', ')} broken by ${ev.id}`
      : c.to === 'watch' ? `Placed on watch by the agent: ${ids.join(', ') || 'an assumption'} shaky after ${ev.id}`
      : `Cleared from watch by the agent: all assumptions holding after ${ev.id}`;
    log(d.id, { kind: 'status-change', actorId: null, fromStatus: c.from, toStatus: c.to, evidenceId: ev.id, cause });
  }

  for (const b of run.briefs) {
    for (const oid of data.decisions[b.decisionId]!.rejectedOptionIds) {
      data.rejectedOptions[oid]!.revivable = run.revivedOptionIds.includes(oid);
    }
    data.briefs[b.id] = structuredClone(b);
    log(b.decisionId, { kind: 'brief-drafted', actorId: null, briefId: b.id, evidenceId: ev.id, cause: `Reopen brief ${b.id} drafted` });
  }

  return data;
}
