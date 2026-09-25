import { describe, expect, it, vi } from 'vitest';
import { buildSeed } from '../data/seed';
import { SAMPLE_SIGNALS } from '../data/samples';
import { defaultSettings } from '../state/initialState';
import type { AgentRunResult, DomainData, EvidenceDraft, ReasoningEngine, Settings } from '../types';
import { extractClaims, hasTerm } from './extract';
import { createEngine } from './index';
import { LocalEngine } from './localEngine';
import type { FetchLike } from './llmEngine';
import { applyRun, runAgent } from './pipeline';
import { nextAssumptionStatus } from './rules';

const thresholds = defaultSettings().thresholds;

function sample(key: string): EvidenceDraft {
  const s = SAMPLE_SIGNALS.find((x) => x.key === key);
  if (!s) throw new Error(`no sample ${key}`);
  return { source: s.source, receivedOn: s.receivedOn, title: s.title, body: s.body };
}

function run(key: string, data: DomainData = buildSeed(), engine: ReasoningEngine = new LocalEngine()): Promise<AgentRunResult> {
  return runAgent({ data, draft: sample(key), submittedBy: 'U-01', engine, thresholds });
}

/* ------------------------------------------------------------------ required */

describe('FrostLink rate notice', () => {
  it('breaks A-104 with confidence above 0.85', async () => {
    const r = await run('frostlink-rate-notice');
    const f = r.evidence.findings.find((x) => x.assumptionId === 'A-104');
    expect(f?.verdict).toBe('contradicts');
    expect(f!.confidence).toBeGreaterThan(0.85);
    expect(f!.extractedValue).toBeCloseTo(49.98, 2);
    expect(r.assumptionChanges).toContainEqual(expect.objectContaining({ assumptionId: 'A-104', from: 'holding', to: 'broken' }));
  });

  it('does not touch A-106', async () => {
    const r = await run('frostlink-rate-notice');
    expect(r.evidence.findings.map((f) => f.assumptionId)).toEqual(['A-104']);
    expect(r.assumptionChanges.some((c) => c.assumptionId === 'A-106')).toBe(false);
    expect(r.trace.some((s) => s.assumptionId === 'A-106')).toBe(false);
  });

  it('writes a one sentence rationale naming the numbers compared', async () => {
    const r = await run('frostlink-rate-notice');
    const { rationale } = r.evidence.findings[0]!;
    expect(rationale).toBe(
      'A 19 percent increase on SGD 42.00 per pallet gives SGD 49.98 per pallet from 1 November 2026, above the SGD 42.00 per pallet ceiling.',
    );
    expect(rationale.match(/\.\s/g)).toBeNull(); // one sentence
  });
});

describe('shaky sample', () => {
  it("produces 'shaky' and not 'broken'", async () => {
    const r = await run('night-shift-quality');
    expect(r.assumptionChanges).toEqual([
      expect.objectContaining({ assumptionId: 'A-127', from: 'holding', to: 'shaky' }),
    ]);
    expect(r.assumptionChanges.some((c) => c.to === 'broken')).toBe(false);
    expect(r.decisionChanges).toEqual([{ decisionId: 'D-10', from: 'active', to: 'watch' }]);
    expect(r.briefs).toEqual([]);
  });

  it('stays shaky however confident, because the figure still passes', () => {
    const a = buildSeed().assumptions['A-127']!;
    const f = { assumptionId: 'A-127', verdict: 'contradicts' as const, confidence: 0.99, rationale: '', extractedValue: 1.17 };
    expect(nextAssumptionStatus(a, f, { ...thresholds, broken: 0.1 })).toBe('shaky');
  });
});

describe('irrelevant sample', () => {
  it('produces zero findings', async () => {
    const r = await run('facilities-notice');
    expect(r.evidence.findings).toEqual([]);
    expect(r.assumptionChanges).toEqual([]);
    expect(r.decisionChanges).toEqual([]);
    expect(r.briefs).toEqual([]);
    expect(r.trace.map((s) => s.kind)).toEqual(['read', 'extract', 'match', 'noop']);
  });

  it('still saw the price rise it chose to ignore', async () => {
    const r = await run('facilities-notice');
    expect(r.trace[1]!.lines).toContain('prices increase of 5 percent effective 1 October 2026');
    expect(r.trace[2]!.lines).toEqual(['No tracked assumption is in scope']);
  });
});

describe('revivability', () => {
  it('computes RO-11 as revivable and RO-12 as not', async () => {
    const data = buildSeed();
    const r = await run('frostlink-rate-notice', data);
    expect(r.revivedOptionIds).toEqual(['RO-11']);

    const brief = r.briefs[0]!;
    expect(brief.revivedOptions.map((o) => o.optionId)).toEqual(['RO-11']);
    expect(brief.revivedOptions[0]!.newComparison).toMatchObject({ incumbentValue: 49.98, optionValue: 45 });
    expect(brief.consideredOptions).toEqual([expect.objectContaining({ optionId: 'RO-12' })]);

    const after = applyRun(data, r);
    expect(after.rejectedOptions['RO-11']!.revivable).toBe(true);
    expect(after.rejectedOptions['RO-12']!.revivable).toBe(false);
  });
});

/* ------------------------------------------------------------------ hero end to end */

describe('hero trace and brief', () => {
  it('emits the eight SPEC steps in order', async () => {
    const r = await run('frostlink-rate-notice');
    expect(r.trace.map((s) => s.kind)).toEqual(['read', 'extract', 'match', 'test', 'verdict', 'status', 'revive', 'draft']);
    expect(r.trace[0]!.lines).toEqual([
      'Source: email, "Notice of rate revision and Jurong consolidation"',
      'Received: 18 September 2026',
      'Length: 418 characters, 62 words',
    ]);
    expect(r.trace[1]!.lines).toContain('rate increase of 19 percent effective 1 November 2026');
    expect(r.trace[2]!.title).toBe('Matching against 34 tracked assumptions across 12 decisions');
    expect(r.trace[3]!.lines).toContain('Computed 42.00 times 1.19 equals 49.98.');
    expect(r.trace[3]!.lines).toContain('49.98 is greater than 42.00.');
    expect(r.trace[4]!.title).toBe('Verdict: broken, confidence 0.91');
    expect(r.trace[5]!.title).toBe('Decision D-07 status: active becomes reopen');
    expect(r.trace[6]!.title).toBe('Checking rejected options for revivability: 1 of 2 options is now favourable');
    expect(r.trace[7]!.title).toBe('Drafting reopen brief and notify list');
  });

  it('drafts a brief for Joanne Lim and Priya Raman with notice before 1 October', async () => {
    const r = await run('frostlink-rate-notice');
    expect(r.briefs).toHaveLength(1);
    const b = r.briefs[0]!;
    expect(b.decisionId).toBe('D-07');
    expect(b.notifyList).toEqual(['U-02', 'U-01']);
    expect(b.actionBy).toBe('2026-10-01');
    expect(b.recommendedNextStep).toMatch(/^Give FrostLink notice before 1 October/);
    expect(b.brokenAssumptions.map((x) => x.assumptionId)).toEqual(['A-104']);
    expect(b.status).toBe('draft');
  });

  it('applies the run without mutating the input', async () => {
    const data = buildSeed();
    const before = JSON.stringify(data);
    const r = await run('frostlink-rate-notice', data);
    const after = applyRun(data, r);
    expect(JSON.stringify(data)).toBe(before);

    expect(after.decisions['D-07']!.status).toBe('reopen');
    expect(after.assumptions['A-104']).toMatchObject({ status: 'broken', confidence: 0.91, currentValue: 49.98 });
    expect(after.evidence['E-10']!.findings).toHaveLength(1);
    expect(after.decisions['D-07']!.evidenceIds).toContain('E-10');
    expect(after.briefs['RB-01']!.decisionId).toBe('D-07');
    expect(after.decisions['D-07']!.historyEntries.slice(-3).map((h) => h.kind)).toEqual(['assumption-change', 'status-change', 'brief-drafted']);
  });

  it('is deterministic', async () => {
    const a = await run('frostlink-rate-notice');
    const b = await run('frostlink-rate-notice');
    expect(b.evidence.findings).toEqual(a.evidence.findings);
    expect(b.trace).toEqual(a.trace);
  });
});

/* ------------------------------------------------------------------ remaining samples */

describe('other samples', () => {
  it('Kargo licence suspension breaks a condition, reopens D-11 and revives RO-16 only', async () => {
    const r = await run('kargo-licence');
    expect(r.assumptionChanges).toEqual([expect.objectContaining({ assumptionId: 'A-129', to: 'broken' })]);
    expect(r.decisionChanges).toEqual([{ decisionId: 'D-11', from: 'active', to: 'reopen' }]);
    expect(r.revivedOptionIds).toEqual(['RO-16']);
  });

  it('FrostLink halal renewal supports A-105 and changes nothing', async () => {
    const r = await run('frostlink-halal-renewal');
    expect(r.evidence.findings).toEqual([expect.objectContaining({ assumptionId: 'A-105', verdict: 'supports' })]);
    expect(r.decisionChanges).toEqual([]);
  });

  it('EV telematics restores A-113 and clears D-04 from watch', async () => {
    const r = await run('ev-telematics-september');
    expect(r.assumptionChanges).toContainEqual(expect.objectContaining({ assumptionId: 'A-113', from: 'shaky', to: 'holding' }));
    expect(r.decisionChanges).toEqual([{ decisionId: 'D-04', from: 'watch', to: 'active' }]);
  });
});

/* ------------------------------------------------------------------ extraction */

describe('extraction', () => {
  it('joins numbers split across lines and keeps decimals inside sentences', () => {
    const ex = extractClaims('Rates will increase by 19\npercent. Error rate was 1.17 percent. Cost was SGD 0.12 per km.', 2026);
    expect(ex.claims.map((c) => [c.kind, c.value])).toEqual([
      ['percent-change', 19],
      ['absolute-value', 1.17],
      ['absolute-value', 0.12],
    ]);
    expect(ex.claims[2]).toMatchObject({ currency: 'SGD', per: 'km' });
  });

  it('reads currency scales, dates without a year and notice periods', () => {
    const ex = extractClaims('Capital cost of SGD 6.8 million. Prices fall 4 percent from 1 October. Notice is due 30 days prior.', 2026);
    expect(ex.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'absolute-value', value: 6_800_000, currency: 'SGD' }),
      expect.objectContaining({ kind: 'percent-change', value: 4, direction: 'decrease', effectiveDate: '2026-10-01' }),
      expect.objectContaining({ tag: 'notice-period', value: 30 }),
    ]));
  });

  it('matches whole words only', () => {
    expect(hasTerm('the level 5 training room', 'EV')).toBe(false);
    expect(hasTerm('new EV vans', 'EV')).toBe(true);
    expect(hasTerm('delisted SKUs', 'SKU')).toBe(true);
  });
});

/* ------------------------------------------------------------------ LLM engine and fallback */

function llmSettings(overrides: Partial<Settings['llm']> = {}): Settings {
  const s = defaultSettings();
  return { ...s, engine: 'llm', llm: { ...s.llm, apiKey: 'test-key', endpoint: 'https://llm.example/v1/chat/completions', model: 'test-model', ...overrides } };
}

const reply = (content: unknown): FetchLike => async () => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] }),
});

describe('LlmEngine', () => {
  it('uses model findings when the response is valid, sending a strict JSON schema', async () => {
    const fetchImpl = vi.fn(reply({ findings: [{ assumptionId: 'A-104', verdict: 'contradicts', confidence: 0.93, rationale: 'Model says 49.98 exceeds 42.00.', extractedValue: 49.98 }] }));
    const onFallback = vi.fn();
    const r = await run('frostlink-rate-notice', buildSeed(), createEngine(llmSettings(), { fetchImpl, onFallback }));

    expect(onFallback).not.toHaveBeenCalled();
    expect(r.fellBack).toBe(false);
    expect(r.engineUsed).toBe('llm');
    expect(r.evidence.findings[0]).toMatchObject({ assumptionId: 'A-104', confidence: 0.93 });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://llm.example/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body as string);
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages[1].content).toContain('A-104');
  });

  const failures: [string, Settings, FetchLike | undefined][] = [
    ['no API key', llmSettings({ apiKey: '' }), undefined],
    ['a network error', llmSettings(), async () => { throw new TypeError('Failed to fetch'); }],
    ['an HTTP error', llmSettings(), async () => ({ ok: false, status: 401, json: async () => ({}) })],
    ['malformed JSON', llmSettings(), reply('{"findings": [')],
    ['an unknown assumption id', llmSettings(), reply({ findings: [{ assumptionId: 'A-999', verdict: 'supports', confidence: 0.5, rationale: 'x', extractedValue: null }] })],
    ['an out of range confidence', llmSettings(), reply({ findings: [{ assumptionId: 'A-104', verdict: 'supports', confidence: 7, rationale: 'x', extractedValue: null }] })],
  ];

  for (const [label, settings, fetchImpl] of failures) {
    it(`falls back to LocalEngine on ${label}`, async () => {
      const onFallback = vi.fn();
      const r = await run('frostlink-rate-notice', buildSeed(), createEngine(settings, { fetchImpl, onFallback }));
      const local = await run('frostlink-rate-notice');

      expect(onFallback).toHaveBeenCalledTimes(1);
      expect(r.fellBack).toBe(true);
      expect(r.engineUsed).toBe('local');
      expect(r.evidence.analysis).toMatchObject({ engine: 'local', fellBack: true });
      expect(r.evidence.findings).toEqual(local.evidence.findings);
      expect(r.briefs.map((b) => b.decisionId)).toEqual(['D-07']);
      // A visible fallback step, then the local trace with no leftover model steps.
      expect(r.trace[0]!.title).toBe('Model unavailable, falling back to the local engine');
      expect(r.trace.slice(1).map((s) => s.kind)).toEqual(local.trace.map((s) => s.kind));
    });
  }

  it('defaults to LocalEngine', () => {
    expect(createEngine(defaultSettings())).toBeInstanceOf(LocalEngine);
  });
});
