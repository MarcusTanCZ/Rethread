// Portfolio metrics: counts by status, value at risk, assumptions broken in last 30 days, median days from break to reopen.
//
// Takes decisions already filtered by visibleDecisions, so metrics can never count what the
// viewer is not allowed to see.
import type { Assumption, AssumptionHealth, ISODate, PortfolioMetrics, VisibleDecision } from '../types';
import { addDays, datePart, daysBetween, today } from './clock';

const LIVE = new Set(['active', 'watch', 'reopen']);

export function assumptionHealth(decision: Pick<VisibleDecision, 'assumptionIds'>, assumptions: Record<string, Assumption>): AssumptionHealth {
  const h: AssumptionHealth = { holding: 0, shaky: 0, broken: 0 };
  for (const id of decision.assumptionIds) {
    const a = assumptions[id];
    if (a) h[a.status] += 1;
  }
  return h;
}

/** Days from each break to the reopen it caused, across the given decisions' history. */
export function breakToReopenDays(decisions: VisibleDecision[]): number[] {
  const out: number[] = [];
  for (const d of decisions) {
    const entries = [...d.historyEntries].sort((a, b) => a.at.localeCompare(b.at));
    let lastBreak: ISODate | null = null;
    for (const e of entries) {
      if (e.kind === 'assumption-change' && e.toAssumptionStatus === 'broken') lastBreak = e.at;
      if (e.kind === 'status-change' && e.toStatus === 'reopen' && lastBreak) {
        out.push(daysBetween(lastBreak, e.at));
        lastBreak = null;
      }
    }
  }
  return out;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function portfolioMetrics(decisions: VisibleDecision[], asOf: ISODate = today()): PortfolioMetrics {
  const since = addDays(asOf, -30);
  let brokenLast30Days = 0;
  for (const d of decisions) {
    for (const e of d.historyEntries) {
      const day = datePart(e.at);
      if (e.kind === 'assumption-change' && e.toAssumptionStatus === 'broken' && day > since && day <= asOf) {
        brokenLast30Days += 1;
      }
    }
  }
  return {
    active: decisions.filter((d) => d.status === 'active').length,
    watch: decisions.filter((d) => d.status === 'watch').length,
    reopen: decisions.filter((d) => d.status === 'reopen').length,
    valueAtRisk: decisions.filter((d) => LIVE.has(d.status)).reduce((sum, d) => sum + (d.valueAtRisk ?? 0), 0),
    brokenLast30Days,
    medianDaysBreakToReopen: median(breakToReopenDays(decisions)),
  };
}
