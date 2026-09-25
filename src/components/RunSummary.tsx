// What an agent run changed: headline, assumption verdicts, decision status moves and the drafted brief, limited to what the viewer may see.
import { ArrowRight, FileSignature, ShieldCheck } from 'lucide-react';
import type { AgentRunResult } from '../types';
import { formatConfidence } from '../lib/format';
import { canSeeDecision, visibleBriefs } from '../state/selectors';
import { useStore } from '../state/store';
import { AssumptionStatusPill, DecisionStatusPill } from './StatusPill';

export function RunSummary({ run }: { run: AgentRunResult }) {
  const { state, dispatch, user } = useStore();
  const open = (decisionId: string) => dispatch({ type: 'navigate', screen: { name: 'decision', decisionId } });

  const seen = (decisionId: string) => canSeeDecision(state, user, decisionId);
  const changes = run.assumptionChanges.filter((c) => c.from !== c.to);
  const visibleChanges = changes.filter((c) => seen(state.assumptions[c.assumptionId]!.decisionId));
  const visibleDecisionChanges = run.decisionChanges.filter((c) => seen(c.decisionId));
  const hidden = run.decisionChanges.length - visibleDecisionChanges.length;
  const briefs = visibleBriefs(state, user).filter((b) => run.briefs.some((r) => r.id === b.id));
  const reopened = run.decisionChanges.filter((c) => c.to === 'reopen').length;
  const watched = run.decisionChanges.filter((c) => c.to === 'watch').length;

  const headline = !run.evidence.findings.length
    ? 'No action taken'
    : reopened ? `${reopened} decision${reopened === 1 ? '' : 's'} reopened`
    : watched ? `${watched} decision${watched === 1 ? '' : 's'} placed on watch`
    : changes.length ? 'Assumptions updated' : 'Assumptions confirmed, nothing changed';

  return (
    <section className="card animate-rise" aria-label="Result">
      <header className="card-header">
        <h2 className="card-title">Result</h2>
        <span className={`text-[12.5px] font-medium ${reopened ? 'text-broken-700' : watched ? 'text-shaky-700' : 'text-slate-700'}`}>{headline}</span>
        <span className="ml-auto text-[11px] text-slate-500">Recorded as {run.evidence.id}{run.fellBack ? ', local engine fallback' : ''}</span>
      </header>

      {!run.evidence.findings.length ? (
        <p className="flex items-start gap-2 px-4 py-3 text-slate-600">
          <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-holding-500" aria-hidden />
          The agent found nothing in this signal that bears on a tracked assumption, so no decision was touched. It is stored as evidence in case it matters later.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {visibleChanges.length > 0 && (
            <div className="px-4 py-2.5">
              <div className="label mb-1.5">Assumptions</div>
              <ul className="space-y-1.5">
                {visibleChanges.map((c) => {
                  const a = state.assumptions[c.assumptionId]!;
                  return (
                    <li key={c.assumptionId} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 font-mono text-[11.5px] text-slate-500">{a.id}</span>
                      <span className="min-w-0 flex-1 truncate" title={a.statement}>{a.statement}</span>
                      <AssumptionStatusPill status={c.from} size="sm" />
                      <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                      <AssumptionStatusPill status={c.to} size="sm" />
                      <span className="w-9 shrink-0 text-right text-[11.5px] tabular-nums text-slate-500">{formatConfidence(c.confidence)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {(visibleDecisionChanges.length > 0 || hidden > 0) && (
            <div className="px-4 py-2.5">
              <div className="label mb-1.5">Decisions</div>
              <ul className="space-y-1.5">
                {visibleDecisionChanges.map((c) => (
                  <li key={c.decisionId} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 font-mono text-[11.5px] text-slate-500">{c.decisionId}</span>
                    <button type="button" onClick={() => open(c.decisionId)} className="min-w-0 flex-1 truncate text-left text-slate-900 hover:text-accent-700 hover:underline">
                      {state.decisions[c.decisionId]!.title}
                    </button>
                    <DecisionStatusPill status={c.from} size="sm" />
                    <ArrowRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                    <DecisionStatusPill status={c.to} size="sm" />
                  </li>
                ))}
                {hidden > 0 && <li className="text-[12px] text-slate-500">{hidden} change{hidden === 1 ? '' : 's'} on decisions outside your portfolio.</li>}
              </ul>
            </div>
          )}
          {!changes.length && (
            <div className="px-4 py-2.5 text-slate-600">
              {run.evidence.findings.map((f) => `${f.assumptionId} ${f.verdict} (${formatConfidence(f.confidence)})`).join(', ')}. No status changed.
            </div>
          )}
          {briefs.map((b) => (
            <div key={b.id} className="flex items-center gap-3 bg-slate-50/60 px-4 py-2.5">
              <FileSignature className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">Reopen brief {b.id} drafted for {b.decisionId}</div>
                <div className="truncate text-[12px] text-slate-500">{b.recommendedNextStep}</div>
              </div>
              <button type="button" className="btn-primary h-8" onClick={() => dispatch({ type: 'navigate', screen: { name: 'brief', briefId: b.id } })}>
                Open brief
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
