// Open reopen briefs as a compact task list, for the portfolio and My decisions.
import { FileSignature } from 'lucide-react';
import type { ReopenBrief } from '../types';
import { formatDayMonth } from '../lib/format';
import { useStore } from '../state/store';
import { BriefStatusPill } from './StatusPill';

export function BriefQueue({ briefs, title }: { briefs: ReopenBrief[]; title: string }) {
  const { state, dispatch } = useStore();
  if (!briefs.length) return null;
  return (
    <section className="card border-broken-500/30" aria-label={title}>
      <header className="card-header py-2">
        <FileSignature className="h-4 w-4 text-broken-700" aria-hidden />
        <h2 className="card-title">{title}</h2>
        <span className="text-[11.5px] text-slate-500">{briefs.length}</span>
      </header>
      <ul className="divide-y divide-slate-100">
        {briefs.map((b) => (
          <li key={b.id} className="flex items-center gap-3 px-4 py-2">
            <span className="w-12 shrink-0 font-mono text-[11.5px] text-slate-500">{b.id}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-900">
                <span className="mr-1.5 font-mono text-[11.5px] font-normal text-slate-500">{b.decisionId}</span>
                {state.decisions[b.decisionId]?.title}
              </div>
              <div className="truncate text-[12px] text-slate-500">{b.recommendedNextStep}</div>
            </div>
            {b.actionBy && <span className="shrink-0 text-[11.5px] text-slate-600">Act by <span className="font-semibold text-slate-900">{formatDayMonth(b.actionBy)}</span></span>}
            <BriefStatusPill status={b.status} />
            <button type="button" className="btn-quiet h-7 px-2.5 text-[12px]" onClick={() => dispatch({ type: 'navigate', screen: { name: 'brief', briefId: b.id } })}>
              Open
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
