// Executive portfolio dashboard: metric tiles, decision table, filters by status and owner.
import { useState } from 'react';
import type { DecisionStatus } from '../types';
import { BriefQueue } from '../components/BriefQueue';
import { DecisionTable, sortBySeverity } from '../components/DecisionTable';
import { MetricTile } from '../components/MetricTile';
import { addDays, today } from '../lib/clock';
import { formatDate, formatSGDCompact } from '../lib/format';
import { portfolioMetrics } from '../lib/metrics';
import { visibleBriefs, visibleDecisions } from '../state/selectors';
import { useStore } from '../state/store';

type StatusFilter = 'all' | DecisionStatus;

/** "2026-08-26" -> "26 Aug". */
const formatDayMonthShort = (iso: string) => formatDate(iso).split(' ').slice(0, 2).join(' ');

export default function PortfolioScreen() {
  const { state, user } = useStore();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [owner, setOwner] = useState<string>('all');

  const all = visibleDecisions(state, user);
  const m = portfolioMetrics(all);
  const owners = [...new Set(all.map((d) => d.owner))].map((id) => state.users[id]!).sort((a, b) => a.name.localeCompare(b.name));
  const openBriefs = visibleBriefs(state, user).filter((b) => b.status !== 'actioned');
  const byOwner = all.filter((d) => owner === 'all' || d.owner === owner);
  const rows = sortBySeverity(byOwner.filter((d) => status === 'all' || d.status === status));
  const count = (s: StatusFilter) => byOwner.filter((d) => s === 'all' || d.status === s).length;

  const chips: [StatusFilter, string][] = [['all', 'All'], ['reopen', 'Reopen'], ['watch', 'On watch'], ['active', 'Active']];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-3">
        <MetricTile label="Active decisions" value={m.active} caption={`of ${all.length} tracked`} />
        <MetricTile label="On watch" value={m.watch} attention={m.watch ? 'amber' : undefined} caption="an assumption is shaky" />
        <MetricTile label="Awaiting reopen" value={m.reopen} attention={m.reopen ? 'red' : undefined} caption={m.reopen ? 'brief open' : 'none'} />
        <MetricTile label="Value at risk" value={formatSGDCompact(m.valueAtRisk)} caption="live decisions" />
        <MetricTile label="Broken, last 30 days" value={m.brokenLast30Days} caption={`since ${formatDayMonthShort(addDays(today(), -30))}`} />
        <MetricTile label="Median break to reopen" value={m.medianDaysBreakToReopen === null ? 'None' : `${m.medianDaysBreakToReopen} d`} caption="days, all time" />
      </div>

      <BriefQueue briefs={openBriefs} title="Reopen briefs awaiting action" />

      <section className="card" aria-label="Decisions">
        <header className="card-header gap-3 py-2">
          <h2 className="card-title">Decisions</h2>
          <div className="flex rounded border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Filter by status">
            {chips.map(([k, label]) => (
              <button key={k} type="button" onClick={() => setStatus(k)} aria-pressed={status === k}
                className={`flex h-6 items-center gap-1.5 rounded-sm px-2 text-[12px] ${status === k ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {label} <span className="tabular-nums text-slate-400">{count(k)}</span>
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-slate-500">
            Owner
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className="field h-7 w-40 py-0 text-[12px]">
              <option value="all">All owners</option>
              {owners.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
        </header>
        <DecisionTable decisions={rows} assumptions={state.assumptions} users={state.users} />
      </section>
    </div>
  );
}
