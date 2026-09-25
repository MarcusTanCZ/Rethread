// Decision detail: header, assumptions, rejected options, evidence timeline, history log.
import type { ReactNode } from 'react';
import { AlertOctagon, ChevronLeft, Eye, FileSignature } from 'lucide-react';
import { AssumptionsList } from '../components/AssumptionsList';
import { EvidenceTimeline } from '../components/EvidenceTimeline';
import { HistoryLog } from '../components/HistoryLog';
import { Money } from '../components/Money';
import { RejectedOptionsPanel } from '../components/RejectedOptionsPanel';
import { BriefStatusPill, DecisionStatusPill } from '../components/StatusPill';
import { daysBetween, today } from '../lib/clock';
import { userName } from '../lib/describe';
import { formatDate, formatDateTime } from '../lib/format';
import { homeScreenFor } from '../state/navigation';
import { assumptionsFor, evidenceFor, rejectedOptionsFor, visibleBriefs, visibleDecision } from '../state/selectors';
import { useStore } from '../state/store';

export default function DecisionDetailScreen() {
  const { state, dispatch, user } = useStore();
  if (state.screen.name !== 'decision' || !user) return null;
  const decision = visibleDecision(state, user, state.screen.decisionId);
  if (!decision) return null;

  const assumptions = assumptionsFor(state, user, decision.id);
  const options = rejectedOptionsFor(state, user, decision.id);
  const evidence = evidenceFor(state, user, decision.id);
  const briefs = visibleBriefs(state, user).filter((b) => b.decisionId === decision.id);
  const latestBrief = briefs[0];
  const home = homeScreenFor(user.role);
  const homeLabel = home.name === 'portfolio' ? 'Portfolio' : home.name === 'my-decisions' ? 'My decisions' : 'Submit evidence';
  const reopened = decision.status === 'reopen';
  const lastMove = [...decision.historyEntries].reverse().find((h) => h.kind === 'status-change' && h.toStatus === decision.status);
  const reviewIn = daysBetween(today(), decision.reviewDate);
  const byId = Object.fromEntries(assumptions.map((a) => [a.id, a]));
  const broken = assumptions.filter((a) => a.status === 'broken');
  const shaky = assumptions.filter((a) => a.status === 'shaky');

  const facts: [string, ReactNode][] = [
    ['Owner', userName(state.users, decision.owner)],
    ['Decided', formatDate(decision.decidedOn)],
    ['Value at risk', <Money key="v" value={decision.valueAtRisk} className="font-semibold text-slate-900" />],
    ['Review date', <span key="r">{formatDate(decision.reviewDate)} <span className={`text-[11.5px] ${reviewIn <= 45 ? 'font-medium text-slate-900' : 'text-slate-500'}`}>({reviewIn >= 0 ? `in ${reviewIn} days` : `${-reviewIn} days ago`})</span></span>],
    ['Category', decision.category],
    ['Stakeholders', decision.stakeholders.map((id) => userName(state.users, id)).join(', ') || 'None'],
  ];

  const panel = <RejectedOptionsPanel decision={decision} options={options} assumptions={byId} />;

  return (
    <div className="space-y-3">
      <section className="card px-4 pb-3 pt-2.5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => dispatch({ type: 'navigate', screen: home })}
            className="-ml-1 inline-flex items-center gap-0.5 rounded px-1 text-[12px] text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> {homeLabel}
          </button>
          <span className="font-mono text-[11.5px] text-slate-400">{decision.id}</span>
          <DecisionStatusPill status={decision.status} />
          {user.role === 'contributor' && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-slate-500"><Eye className="h-3.5 w-3.5" aria-hidden /> Read only, you are a stakeholder</span>
          )}
        </div>
        <p className="mt-1.5 max-w-4xl text-slate-600">{decision.summary}</p>
        <dl className="mt-2.5 grid grid-cols-6 gap-x-4 border-t border-slate-100 pt-2.5">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
              <dd className="mt-0.5 truncate text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {reopened && (
        <div role="status" className="flex items-center gap-3 rounded-md border border-broken-500/40 bg-broken-50 px-4 py-2.5">
          <AlertOctagon className="h-5 w-5 shrink-0 text-broken-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-broken-700">
              Reopened{lastMove ? ` ${formatDateTime(lastMove.at)}` : ''}: {broken.map((a) => a.id).join(', ')} no longer holds
            </div>
            <div className="truncate text-[12px] text-slate-700">{broken.map((a) => a.statement).join('; ')}</div>
          </div>
          {latestBrief && (
            <>
              <BriefStatusPill status={latestBrief.status} />
              <button type="button" className="btn-primary h-8"
                onClick={() => dispatch({ type: 'navigate', screen: { name: 'brief', briefId: latestBrief.id } })}>
                <FileSignature className="h-3.5 w-3.5" aria-hidden /> Open reopen brief
              </button>
            </>
          )}
        </div>
      )}
      {decision.status === 'watch' && (
        <div role="status" className="flex items-center gap-2.5 rounded-md border border-shaky-500/40 bg-shaky-50 px-4 py-2 text-[12.5px] text-shaky-700">
          <Eye className="h-4 w-4 shrink-0" aria-hidden />
          <span><span className="font-semibold">On watch.</span> {shaky.map((a) => `${a.id} is shaky (${a.statement})`).join('; ')}.</span>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)] items-start gap-3">
        <div className="min-w-0 space-y-3">
          {reopened && panel}
          <AssumptionsList assumptions={assumptions} />
          {!reopened && panel}
        </div>
        <div className="min-w-0 space-y-3">
          <EvidenceTimeline evidence={evidence} users={state.users} />
          <HistoryLog entries={decision.historyEntries} users={state.users} />
        </div>
      </div>
    </div>
  );
}
