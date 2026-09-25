// Pure rules: finding to assumption status, assumption statuses to decision status, and thresholds from settings.
import type { Assumption, AssumptionStatus, ConfidenceThresholds, DecisionStatus, Finding } from '../types';
import { passes } from './units';

/**
 * The status a finding moves an assumption to, or null for no change.
 * - supports at or above the shaky threshold: holding
 * - contradicts on a threshold whose figure still passes (inside the margin): shaky at most,
 *   never broken, however confident
 * - contradicts at or above the broken threshold: broken
 * - contradicts at or above the shaky threshold: shaky
 * - anything weaker, or neutral: no change
 */
export function nextAssumptionStatus(a: Assumption, f: Finding, t: ConfidenceThresholds): AssumptionStatus | null {
  if (f.verdict === 'neutral' || f.confidence < t.shaky) return null;
  if (f.verdict === 'supports') return 'holding';
  if (a.test.kind === 'threshold' && f.extractedValue !== undefined && passes(a.test, f.extractedValue)) return 'shaky';
  return f.confidence >= t.broken ? 'broken' : 'shaky';
}

const RANK: Record<DecisionStatus, number> = { active: 0, watch: 1, reopen: 2, superseded: 3, closed: 3 };

/**
 * Decision status implied by its assumptions.
 * - any critical assumption broken: reopen
 * - any assumption shaky, or a supporting one broken: watch
 * - otherwise: active
 * A reopened decision never drops back automatically (a person must reaffirm it), and
 * superseded or closed decisions are left alone. Watch clears to active when all hold.
 */
export function nextDecisionStatus(current: DecisionStatus, assumptions: Pick<Assumption, 'status' | 'criticality'>[]): DecisionStatus {
  if (current === 'superseded' || current === 'closed') return current;
  const target: DecisionStatus = assumptions.some((a) => a.status === 'broken' && a.criticality === 'critical')
    ? 'reopen'
    : assumptions.some((a) => a.status !== 'holding')
      ? 'watch'
      : 'active';
  if (current === 'reopen' && RANK[target] < RANK.reopen) return 'reopen';
  return target;
}
