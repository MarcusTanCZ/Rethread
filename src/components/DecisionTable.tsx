// Decision table shared by the portfolio and My decisions: title, owner, status pill, value at risk, assumption health and review date.
import type { Assumption, DecisionStatus, User, UserId, VisibleDecision } from '../types';
import { daysBetween, today } from '../lib/clock';
import { userName } from '../lib/describe';
import { formatDate } from '../lib/format';
import { assumptionHealth } from '../lib/metrics';
import { useStore } from '../state/store';
import { AssumptionHealthBar } from './AssumptionHealthBar';
import { Money } from './Money';
import { DecisionStatusPill } from './StatusPill';

const SEVERITY: Record<DecisionStatus, number> = { reopen: 0, watch: 1, active: 2, superseded: 3, closed: 4 };

/** Reopened first, then on watch, then by value at risk. */
export function sortBySeverity(ds: VisibleDecision[]): VisibleDecision[] {
  return [...ds].sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || (b.valueAtRisk ?? 0) - (a.valueAtRisk ?? 0) || a.id.localeCompare(b.id));
}

export function DecisionTable({ decisions, assumptions, users, showOwner = true, showValue = true, showReview = true, empty }: {
  decisions: VisibleDecision[];
  assumptions: Record<string, Assumption>;
  users: Record<UserId, User>;
  showOwner?: boolean;
  showValue?: boolean;
  showReview?: boolean;
  empty?: string;
}) {
  const { dispatch } = useStore();
  const open = (id: string) => dispatch({ type: 'navigate', screen: { name: 'decision', decisionId: id } });

  return (
    <table className="w-full table-fixed text-left">
      <colgroup>
        <col className="w-[62px]" />
        <col />
        {showOwner && <col className="w-[120px]" />}
        <col className="w-[92px]" />
        <col className="w-[132px]" />
        {showValue && <col className="w-[128px]" />}
        {showReview && <col className="w-[112px]" />}
      </colgroup>
      <thead className="border-b border-slate-200 bg-slate-50/70">
        <tr>
          <th className="th pl-4">ID</th>
          <th className="th">Decision</th>
          {showOwner && <th className="th">Owner</th>}
          <th className="th">Status</th>
          <th className="th">Assumptions</th>
          {showValue && <th className="th text-right">Value at risk</th>}
          {showReview && <th className="th pr-4 text-right">Review</th>}
        </tr>
      </thead>
      <tbody>
        {decisions.length === 0 && (
          <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">{empty ?? 'No decisions match.'}</td></tr>
        )}
        {decisions.map((d) => {
          const days = daysBetween(today(), d.reviewDate);
          return (
            <tr key={d.id} onClick={() => open(d.id)}
              className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${d.status === 'reopen' ? 'shadow-[inset_3px_0_0] shadow-broken-500' : ''}`}>
              <td className="td pl-4 font-mono text-[11.5px] text-slate-500">{d.id}</td>
              <td className="td min-w-0">
                <button type="button" onClick={(e) => { e.stopPropagation(); open(d.id); }}
                  className="block max-w-full truncate text-left font-medium text-slate-900 hover:text-accent-700 hover:underline" title={d.title}>
                  {d.title}
                </button>
                <div className="truncate text-[11px] text-slate-500">{d.category}, decided {formatDate(d.decidedOn)}</div>
              </td>
              {showOwner && <td className="td truncate text-slate-700">{userName(users, d.owner)}</td>}
              <td className="td"><DecisionStatusPill status={d.status} /></td>
              <td className="td"><AssumptionHealthBar health={assumptionHealth(d, assumptions)} /></td>
              {showValue && <td className="td text-right"><Money value={d.valueAtRisk} className="text-slate-900" /></td>}
              {showReview && (
                <td className="td pr-4 text-right tabular-nums">
                  <div className="text-slate-700">{formatDate(d.reviewDate)}</div>
                  <div className={`text-[11px] ${days <= 45 && days >= 0 ? 'font-medium text-slate-700' : 'text-slate-400'}`}>
                    {days >= 0 ? `in ${days} days` : `${-days} days ago`}
                  </div>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
