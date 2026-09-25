// Owner home: reopen tasks assigned to them, a few headline counts, and the decisions they own.
import { CheckCircle2 } from 'lucide-react';
import { BriefQueue } from '../components/BriefQueue';
import { DecisionTable, sortBySeverity } from '../components/DecisionTable';
import { MetricTile } from '../components/MetricTile';
import { formatSGDCompact } from '../lib/format';
import { portfolioMetrics } from '../lib/metrics';
import { visibleBriefs, visibleDecisions } from '../state/selectors';
import { useStore } from '../state/store';

export default function MyDecisionsScreen() {
  const { state, user } = useStore();
  const mine = visibleDecisions(state, user);
  const m = portfolioMetrics(mine);
  const tasks = visibleBriefs(state, user).filter((b) => b.status !== 'actioned');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <MetricTile label="Decisions you own" value={mine.length} />
        <MetricTile label="On watch" value={m.watch} attention={m.watch ? 'amber' : undefined} />
        <MetricTile label="Reopen tasks" value={tasks.length} attention={tasks.length ? 'red' : undefined} />
        <MetricTile label="Your value at risk" value={formatSGDCompact(m.valueAtRisk)} />
      </div>

      {tasks.length ? (
        <BriefQueue briefs={tasks} title="Reopen tasks assigned to you" />
      ) : (
        <div className="card flex items-center gap-2.5 px-4 py-2.5 text-slate-600">
          <CheckCircle2 className="h-4 w-4 text-holding-500" aria-hidden />
          No reopen tasks. If new evidence breaks an assumption on a decision you own, the brief lands here.
        </div>
      )}

      <section className="card" aria-label="Your decisions">
        <header className="card-header py-2">
          <h2 className="card-title">Your decisions</h2>
          <span className="text-[11.5px] text-slate-500">Reopened and on watch first</span>
        </header>
        <DecisionTable decisions={sortBySeverity(mine)} assumptions={state.assumptions} users={state.users} showOwner={false} />
      </section>
    </div>
  );
}
