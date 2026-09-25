// LlmEngine: optional chat completions ReasoningEngine with strict JSON schema output; throws on any error so the caller can fall back.
//
// Targets any OpenAI compatible /chat/completions endpoint. The API key comes from settings,
// which live in localStorage only; nothing here is ever bundled or seeded.
import type { Assumption, Evidence, Finding, LlmSettings, ReasoningEngine, TraceSink, Verdict } from '../types';
import { formatLongDate, formatNumber } from '../lib/format';

export type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

const VERDICTS: Verdict[] = ['supports', 'contradicts', 'neutral'];

const SYSTEM_PROMPT = [
  'You test business assumptions against a new piece of evidence.',
  'For each assumption the evidence genuinely bears on, return one finding. Ignore assumptions the evidence does not mention; an irrelevant signal returns an empty findings array.',
  'verdict: "supports" if the evidence shows the assumption still holds, "contradicts" if it shows it no longer holds or is close to failing, "neutral" if it is mentioned without a bearing.',
  'For threshold tests, compute the value the evidence implies. If it states a percentage change, apply it to currentValue (or baseline if currentValue is absent). Put that number in extractedValue; otherwise use null.',
  'confidence is between 0 and 1. rationale is one plain English sentence that names the numbers you compared.',
].join(' ');

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['assumptionId', 'verdict', 'confidence', 'rationale', 'extractedValue'],
        properties: {
          assumptionId: { type: 'string' },
          verdict: { type: 'string', enum: VERDICTS },
          confidence: { type: 'number' },
          rationale: { type: 'string' },
          extractedValue: { type: ['number', 'null'] },
        },
      },
    },
  },
} as const;

/** Validates the model's JSON strictly. Any deviation throws, which triggers the fallback. */
export function parseFindings(content: unknown, known: Set<string>): Finding[] {
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { findings?: unknown }).findings)) {
    throw new Error('Response is not an object with a findings array');
  }
  const seen = new Set<string>();
  return (parsed as { findings: unknown[] }).findings.map((raw, i) => {
    const f = raw as Record<string, unknown>;
    const where = `findings[${i}]`;
    if (typeof f.assumptionId !== 'string' || !known.has(f.assumptionId)) throw new Error(`${where}: unknown assumptionId`);
    if (seen.has(f.assumptionId)) throw new Error(`${where}: duplicate assumptionId ${f.assumptionId}`);
    seen.add(f.assumptionId);
    if (!VERDICTS.includes(f.verdict as Verdict)) throw new Error(`${where}: invalid verdict`);
    if (typeof f.confidence !== 'number' || !(f.confidence >= 0 && f.confidence <= 1)) throw new Error(`${where}: confidence out of range`);
    if (typeof f.rationale !== 'string' || !f.rationale.trim()) throw new Error(`${where}: empty rationale`);
    if (f.extractedValue !== null && f.extractedValue !== undefined && (typeof f.extractedValue !== 'number' || !Number.isFinite(f.extractedValue))) {
      throw new Error(`${where}: extractedValue is not a number`);
    }
    return {
      assumptionId: f.assumptionId,
      verdict: f.verdict as Verdict,
      confidence: Math.round(f.confidence * 100) / 100,
      rationale: f.rationale.trim(),
      ...(typeof f.extractedValue === 'number' ? { extractedValue: f.extractedValue } : {}),
    };
  });
}

export class LlmEngine implements ReasoningEngine {
  readonly kind = 'llm' as const;

  constructor(
    private readonly settings: LlmSettings,
    private readonly fetchImpl: FetchLike | undefined = globalThis.fetch?.bind(globalThis),
  ) {}

  async analyse(evidence: Evidence, assumptions: Assumption[], onTrace?: TraceSink): Promise<Finding[]> {
    const { apiKey, endpoint, model, timeoutMs } = this.settings;
    if (!apiKey.trim()) throw new Error('No API key is set');
    if (!endpoint.trim()) throw new Error('No endpoint is set');
    if (!model.trim()) throw new Error('No model is set');
    if (!this.fetchImpl) throw new Error('fetch is not available');

    onTrace?.({
      kind: 'read',
      title: 'Reading signal',
      lines: [
        `Source: ${evidence.source}, "${evidence.title}"`,
        `Received: ${formatLongDate(evidence.receivedOn)}`,
        `Length: ${formatNumber(evidence.body.length)} characters`,
      ],
      tone: 'info',
    });
    const decisions = new Set(assumptions.map((a) => a.decisionId)).size;
    onTrace?.({
      kind: 'match',
      title: `Matching against ${assumptions.length} tracked assumptions across ${decisions} decisions`,
      lines: [`Sent to ${model} for assessment`],
      tone: 'info',
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let payload: unknown;
    try {
      const res = await this.fetchImpl(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_schema', json_schema: { name: 'findings', strict: true, schema: RESPONSE_SCHEMA } },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: JSON.stringify({
                evidence: { title: evidence.title, source: evidence.source, receivedOn: evidence.receivedOn, body: evidence.body },
                assumptions: assumptions.map((a) => ({ id: a.id, statement: a.statement, test: a.test, currentValue: a.currentValue ?? null })),
              }),
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Endpoint returned HTTP ${res.status}`);
      payload = await res.json();
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error(`No response within ${timeoutMs} ms`);
      throw e;
    } finally {
      clearTimeout(timer);
    }

    const content = (payload as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
    if (content === undefined) throw new Error('Response has no message content');
    const byId = new Map(assumptions.map((a) => [a.id, a]));
    const findings = parseFindings(content, new Set(byId.keys()));

    for (const f of findings) {
      const a = byId.get(f.assumptionId)!;
      onTrace?.({
        kind: 'test',
        title: `Testing assumption ${a.id}: "${a.statement}"`,
        lines: [f.rationale],
        tone: f.verdict === 'contradicts' ? 'alert' : f.verdict === 'supports' ? 'ok' : 'info',
        assumptionId: a.id,
        decisionId: a.decisionId,
      });
    }
    return findings;
  }
}
