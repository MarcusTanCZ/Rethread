// Chronological log of status changes and actions with timestamp and cause, newest first.
import { ArrowRight, Bot, User as UserIcon } from 'lucide-react';
import type { HistoryEntry, User, UserId } from '../types';
import { userName } from '../lib/describe';
import { formatDateTime } from '../lib/format';
import { AssumptionStatusPill, DecisionStatusPill } from './StatusPill';

export function HistoryLog({ entries, users }: { entries: HistoryEntry[]; users: Record<UserId, User> }) {
  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  return (
    <section className="card" aria-label="History">
      <header className="card-header">
        <h2 className="card-title">History</h2>
        <span className="text-[11.5px] text-slate-500">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
      </header>
      <ol className="divide-y divide-slate-100">
        {sorted.map((h) => (
          <li key={h.id} className="px-4 py-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="tabular-nums">{formatDateTime(h.at)}</span>
              <span className="ml-auto inline-flex items-center gap-1">
                {h.actorId === null ? <Bot className="h-3 w-3" aria-hidden /> : <UserIcon className="h-3 w-3" aria-hidden />}
                {userName(users, h.actorId)}
              </span>
            </div>
            {h.kind === 'status-change' && h.fromStatus && h.toStatus && (
              <div className="mt-1 flex items-center gap-1.5">
                <DecisionStatusPill status={h.fromStatus} size="sm" />
                <ArrowRight className="h-3 w-3 text-slate-400" aria-hidden />
                <DecisionStatusPill status={h.toStatus} size="sm" />
              </div>
            )}
            {h.kind === 'assumption-change' && h.fromAssumptionStatus && h.toAssumptionStatus && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-slate-500">{h.assumptionId}</span>
                <AssumptionStatusPill status={h.fromAssumptionStatus} size="sm" />
                <ArrowRight className="h-3 w-3 text-slate-400" aria-hidden />
                <AssumptionStatusPill status={h.toAssumptionStatus} size="sm" />
              </div>
            )}
            <p className="mt-0.5 text-[12px] leading-snug text-slate-700">{h.cause}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
