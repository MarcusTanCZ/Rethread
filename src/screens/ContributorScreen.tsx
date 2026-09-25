// Contributor home: submit evidence, see a redacted result, and a read only list of decisions where they are a stakeholder.
import { CheckCircle2, Info, Loader2 } from 'lucide-react';
import type { AgentRunResult } from '../types';
import { EvidenceComposer } from '../components/EvidenceComposer';
import { DecisionTable, sortBySeverity } from '../components/DecisionTable';
import { AssumptionStatusPill, DecisionStatusPill } from '../components/StatusPill';
import { useAgentRun } from '../lib/useAgentRun';
import { canSeeDecision, visibleDecisions } from '../state/selectors';
import { useStore } from '../state/store';

/**
 * What a contributor may learn from their own submission (DECISIONS.md): counts, and details
 * only for decisions where they are a stakeholder. No trace, no values, no other decision names.
 */
function RedactedResult({ run }: { run: AgentRunResult }) {
  const { state, user, dispatch } = useStore();
  const seen = (id: string) => canSeeDecision(state, user, id);
  const changes = run.assumptionChanges.filter((c) => c.from !== c.to);
  const mineA = changes.filter((c) => seen(state.assumptions[c.assumptionId]!.decisionId));
  const mineD = run.decisionChanges.filter((c) => seen(c.decisionId));
  const otherDecisions = new Set(changes.map((c) => state.assumptions[c.assumptionId]!.decisionId).filter((id) => !seen(id))).size;

  return (
    <section className="card animate-rise" aria-label="Submission result">
      <header className="card-header">
        <CheckCircle2 className="h-4 w-4 text-holding-500" aria-hidden />
        <h2 className="card-title">Submitted as {run.evidence.id}</h2>
        <span className="ml-auto text-[11.5px] text-slate-500">The agent has analysed it</span>
      </header>
      <div className="space-y-2 px-4 py-3">
        {!run.evidence.findings.length ? (
          <p className="text-slate-600">Nothing in this signal bears on a tracked assumption. It is stored in case it matters later.</p>
        ) : (
          <>
            {mineD.map((c) => (
              <div key={c.decisionId} className="flex items-center gap-2">
                <span className="w-12 font-mono text-[11.5px] text-slate-500">{c.decisionId}</span>
                <button type="button" className="min-w-0 flex-1 truncate text-left font-medium text-slate-900 hover:text-accent-700 hover:underline"
                  onClick={() => dispatch({ type: 'navigate', screen: { name: 'decision', decisionId: c.decisionId } })}>
                  {state.decisions[c.decisionId]!.title}
                </button>
                <DecisionStatusPill status={c.from} size="sm" />
                <span className="text-slate-400">to</span>
                <DecisionStatusPill status={c.to} size="sm" />
              </div>
            ))}
            {mineA.map((c) => (
              <div key={c.assumptionId} className="flex items-center gap-2 text-[12.5px]">
                <span className="w-12 font-mono text-[11.5px] text-slate-500">{c.assumptionId}</span>
                <span className="min-w-0 flex-1 truncate text-slate-700">{state.assumptions[c.assumptionId]!.statement}</span>
                <AssumptionStatusPill status={c.to} size="sm" />
              </div>
            ))}
            {!mineA.length && !mineD.length && <p className="text-slate-600">It did not change any decision you follow.</p>}
            {otherDecisions > 0 && (
              <p className="flex items-center gap-1.5 text-[12px] text-slate-500">
                <Info className="h-3.5 w-3.5" aria-hidden />
                It also affected {otherDecisions} decision{otherDecisions === 1 ? '' : 's'} you do not have access to. Their owners have been informed.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default function ContributorScreen() {
  const { state, user } = useStore();
  const { run, phase, start } = useAgentRun({ animate: false });
  const mine = sortBySeverity(visibleDecisions(state, user));

  return (
    <div className="grid h-full min-h-[560px] grid-cols-[minmax(340px,380px)_minmax(0,1fr)] gap-4">
      <EvidenceComposer onRun={start} busy={phase === 'thinking'} runLabel="Submit evidence" />
      <div className="min-w-0 space-y-3 overflow-y-auto">
        {phase === 'thinking' && (
          <div className="card flex items-center gap-2 px-4 py-3 text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Analysing your signal
          </div>
        )}
        {run && phase === 'done' && <RedactedResult run={run} />}
        <section className="card" aria-label="Decisions you contribute to">
          <header className="card-header py-2">
            <h2 className="card-title">Decisions you contribute to</h2>
            <span className="text-[11.5px] text-slate-500">Read only. Values are not shown for your role.</span>
          </header>
          <DecisionTable decisions={mine} assumptions={state.assumptions} users={state.users} showValue={false} showReview={false}
            empty="You are not a stakeholder on any decision yet." />
        </section>
      </div>
    </div>
  );
}
