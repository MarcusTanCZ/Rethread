// LocalEngine: offline deterministic ReasoningEngine implementing threshold and condition tests, emitting trace steps.
//
// Emits the first four kinds of trace step (read, extract, match, test). The pipeline adds
// verdict, status, revival and drafting steps once findings are turned into status changes.
import type {
  Assumption,
  ConditionTest,
  Evidence,
  ExtractedClaim,
  Finding,
  ReasoningEngine,
  ThresholdTest,
  TraceSink,
  TraceStep,
  TraceTone,
} from '../types';
import { formatLongDate, formatNumber } from '../lib/format';
import { describeClaims, extractClaims, hasTerm, termPattern, type Extraction } from './extract';
import { fmt, formatQuantity, headroom, operatorNoun, passes, unitMatches } from './units';

export interface LocalEngineOptions {
  /** A passing threshold figure closer than this fraction to the limit is reported as shaky. */
  shakyMargin?: number;
}

type Evaluation =
  | { kind: 'finding'; finding: Finding; lines: string[]; tone: TraceTone }
  | { kind: 'named'; reason: string }
  | { kind: 'none' };

const SOURCE_LABEL: Record<Evidence['source'], string> = {
  email: 'email', 'meeting-note': 'meeting note', metric: 'metric report', regulatory: 'regulatory notice', news: 'news', manual: 'manual entry',
};

const POSITIVE_CUES = ['renewed', 'confirmed', 'valid', 'retains', 'retained', 'approved', 'committed', 'reinstated', 'extended'];
const NEGATED = /\b(?:not|no|never|without)\s+(?:been\s+|be\s+|yet\s+)?$/i;

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampConfidence = (n: number) => Math.min(0.97, Math.max(0.05, round2(n)));

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}


export class LocalEngine implements ReasoningEngine {
  readonly kind = 'local' as const;
  private readonly shakyMargin: number;

  constructor(options: LocalEngineOptions = {}) {
    this.shakyMargin = options.shakyMargin ?? 0.03;
  }

  async analyse(evidence: Evidence, assumptions: Assumption[], onTrace?: TraceSink): Promise<Finding[]> {
    return this.analyseSync(evidence, assumptions, onTrace);
  }

  /** Synchronous core, exposed for tests and for callers that do not need a promise. */
  analyseSync(evidence: Evidence, assumptions: Assumption[], onTrace?: TraceSink): Finding[] {
    const emit = (s: TraceStep) => onTrace?.(s);
    const ex = extractClaims(evidence.body, Number(evidence.receivedOn.slice(0, 4)));
    const text = ex.sentences.join(' ');
    const words = evidence.body.trim() ? evidence.body.trim().split(/\s+/).length : 0;

    emit({
      kind: 'read',
      title: 'Reading signal',
      lines: [
        `Source: ${SOURCE_LABEL[evidence.source]}, "${evidence.title}"`,
        `Received: ${formatLongDate(evidence.receivedOn)}`,
        `Length: ${formatNumber(evidence.body.length)} characters, ${formatNumber(words)} words`,
      ],
      tone: 'info',
    });

    const described = describeClaims(ex);
    emit({
      kind: 'extract',
      title: 'Extracting claims',
      lines: described.length ? described : ['No figures, percentages or dates found'],
      tone: 'info',
    });

    const sorted = [...assumptions].sort((a, b) => a.id.localeCompare(b.id));
    const evaluations = sorted.map((a) => ({ a, e: this.evaluate(a, ex, text) }));
    const hits = evaluations.filter((x): x is { a: Assumption; e: Extract<Evaluation, { kind: 'finding' }> } => x.e.kind === 'finding');
    const named = evaluations.filter((x) => x.e.kind === 'named');
    const decisionCount = new Set(sorted.map((a) => a.decisionId)).size;

    const matchLines = hits.map(({ a }) => `In scope: ${a.id} on ${a.decisionId}, "${a.statement}"`);
    if (named.length) {
      matchLines.push(`Related names but nothing testable: ${named.map(({ a }) => a.id).join(', ')}`);
    }
    if (!hits.length && !named.length) matchLines.push('No tracked assumption is in scope');
    emit({
      kind: 'match',
      title: `Matching against ${sorted.length} tracked assumptions across ${decisionCount} decisions`,
      lines: matchLines,
      tone: 'info',
    });

    for (const { a, e } of hits) {
      emit({
        kind: 'test',
        title: `Testing assumption ${a.id}: "${a.statement}"`,
        lines: e.lines,
        tone: e.tone,
        assumptionId: a.id,
        decisionId: a.decisionId,
      });
    }

    return hits.map(({ e }) => e.finding);
  }

  private evaluate(a: Assumption, ex: Extraction, text: string): Evaluation {
    return a.test.kind === 'threshold' ? this.threshold(a, a.test, ex, text) : this.condition(a, a.test, ex, text);
  }

  /* ---------------------------------------------------------------- threshold tests */

  private threshold(a: Assumption, test: ThresholdTest, ex: Extraction, text: string): Evaluation {
    if (!test.scope.some((t) => hasTerm(text, t))) return { kind: 'none' };

    // The figure nearest a metric alias in the same sentence: a percentage change, or an
    // absolute value in a compatible unit.
    let best: { claim: ExtractedClaim; distance: number } | null = null;
    let aliasSeen = false;
    ex.sentences.forEach((s, si) => {
      const positions = test.metricAliases
        .map((al) => termPattern(al).exec(s)?.index ?? -1)
        .filter((i) => i >= 0);
      if (!positions.length) return;
      aliasSeen = true;
      for (const c of ex.claims) {
        if (c.sentence !== si) continue;
        const usable = c.kind === 'percent-change' || (c.kind === 'absolute-value' && unitMatches(c, test));
        if (!usable) continue;
        const distance = Math.min(...positions.map((p) => Math.abs(c.start - p)));
        if (!best || distance < best.distance) best = { claim: c, distance };
      }
    });
    if (!best) return { kind: 'named', reason: aliasSeen ? 'no figure in a matching unit' : 'metric not mentioned' };

    const claim = (best as { claim: ExtractedClaim }).claim;
    const base = a.currentValue ?? test.baseline;
    const inferred = claim.kind === 'percent-change';
    const factor = inferred ? 1 + ((claim.direction === 'decrease' ? -1 : 1) * claim.value!) / 100 : 1;
    const value = inferred ? Number((base * factor).toFixed(4)) : claim.value!;
    const ok = passes(test, value);
    const room = headroom(test, value);
    const nearLimit = ok && room < this.shakyMargin;
    const dated = !!claim.effectiveDate || ex.claims.some((c) => c.sentence === claim.sentence && c.kind === 'date');

    // Evidence strength: an alias beside the figure, the scoped entity named, a date.
    const strength = 0.35 + 0.3 + 0.15 + (dated ? 0.05 : 0) - (inferred ? 0.04 : 0);
    const confidence = clampConfidence(
      !ok ? strength + Math.min(0.1, -room) : nearLimit ? strength * 0.75 : strength + Math.min(0.1, room),
    );

    const u = test.unit;
    const n = (v: number) => fmt(v, u, value, test.value, base);
    const q = (v: number) => formatQuantity(v, u, value, test.value, base);
    const noun = operatorNoun(test.operator);
    const side = test.operator === '<=' ? 'above' : test.operator === '>=' ? 'below' : 'away from';
    const pct = `${formatNumber(Math.abs(room) * 100, 1)} percent`;
    const eff = claim.effectiveDate ? ` from ${formatLongDate(claim.effectiveDate)}` : '';

    const lines: string[] = [];
    lines.push(inferred ? `Found: ${claim.summary}` : `Found: ${q(value)}`);
    if (inferred) lines.push(`Computed ${n(base)} times ${formatNumber(factor, String(factor).split('.')[1]?.length ?? 0)} equals ${n(value)}.`);
    if (!ok) {
      const cmp = test.operator === '<=' ? 'greater than' : test.operator === '>=' ? 'less than' : 'different from';
      lines.push(`${n(value)} is ${cmp} ${n(test.value)}.`);
    } else if (nearLimit) {
      lines.push(`${n(value)} is within the ${noun} of ${n(test.value)}, but only ${pct} from it.`);
    } else {
      lines.push(`${n(value)} clears the ${noun} of ${n(test.value)} by ${pct}.`);
    }

    const limit = `${q(test.value)} ${noun}`;
    const rationale = inferred
      ? `A ${formatNumber(claim.value!, claim.value! % 1 ? 2 : 0)} percent ${claim.direction} on ${q(base)} gives ${q(value)}${eff}, ` +
        (!ok ? `${side} the ${limit}.` : nearLimit ? `still within the ${limit} but only ${pct} from it.` : `clearing the ${limit} by ${pct}.`)
      : `Reported ${q(value)} ` +
        (!ok ? `is ${side} the ${limit}.` : nearLimit ? `is still within the ${limit}, but only ${pct} from it.` : `clears the ${limit} by ${pct}.`);

    return {
      kind: 'finding',
      finding: {
        assumptionId: a.id,
        verdict: ok && !nearLimit ? 'supports' : 'contradicts',
        confidence,
        rationale,
        extractedValue: value,
      },
      lines,
      tone: !ok ? 'alert' : nearLimit ? 'warn' : 'ok',
    };
  }

  /* ---------------------------------------------------------------- condition tests */

  private condition(a: Assumption, test: ConditionTest, ex: Extraction, text: string): Evaluation {
    const found = test.keywords.filter((k) => hasTerm(text, k));
    if (!found.length) return { kind: 'none' };
    if (found.length < Math.min(2, test.keywords.length)) return { kind: 'named', reason: `only "${found[0]}" mentioned` };

    const negatives: string[] = [];
    let sameSentence = false;
    for (const neg of test.negativeKeywords) {
      for (const s of ex.sentences) {
        const re = new RegExp(termPattern(neg).source, 'gi');
        for (const m of s.matchAll(re)) {
          if (NEGATED.test(s.slice(Math.max(0, m.index! - 20), m.index))) continue;
          if (!negatives.includes(neg)) negatives.push(neg);
          if (found.some((k) => hasTerm(s, k))) sameSentence = true;
        }
      }
    }
    const cues = POSITIVE_CUES.filter((c) => hasTerm(text, c));
    const k = Math.min(found.length, 3) * 0.08;
    const lines = [`Keywords found: ${found.join(', ')} (${found.length} of ${test.keywords.length})`];

    if (negatives.length) {
      lines.push(`Contradicting terms: ${negatives.join(', ')}`);
      return {
        kind: 'finding',
        finding: {
          assumptionId: a.id,
          verdict: 'contradicts',
          confidence: clampConfidence(0.4 + k + Math.min(negatives.length, 2) * 0.12 + (sameSentence ? 0.05 : 0)),
          rationale: `The signal names ${list(found)} alongside "${negatives.join('" and "')}", which contradicts the assumption "${a.statement}".`,
        },
        lines,
        tone: 'alert',
      };
    }

    lines.push(`No contradicting terms (checked ${test.negativeKeywords.join(', ')})`);
    if (cues.length) {
      lines.push(`Confirming terms: ${cues.join(', ')}`);
      return {
        kind: 'finding',
        finding: {
          assumptionId: a.id,
          verdict: 'supports',
          confidence: clampConfidence(0.4 + k + Math.min(cues.length, 2) * 0.08),
          rationale: `The signal names ${list(found)} with "${cues.join('" and "')}" and no contradicting terms, which supports the assumption "${a.statement}".`,
        },
        lines,
        tone: 'ok',
      };
    }
    return {
      kind: 'finding',
      finding: {
        assumptionId: a.id,
        verdict: 'neutral',
        confidence: clampConfidence(0.4 + k),
        rationale: `The signal names ${list(found)} but says nothing that confirms or contradicts the assumption "${a.statement}".`,
      },
      lines,
      tone: 'info',
    };
  }
}
