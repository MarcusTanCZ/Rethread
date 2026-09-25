// Printable one page reopen brief with struck through rejection reasons, Notify stakeholders (mocked) and Mark actioned.
import type { ReactNode } from 'react';
import { CalendarClock, CheckCheck, ChevronLeft, Printer, Send } from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { Money } from '../components/Money';
import { ROLE_LABEL } from '../components/roleLabels';
import { AssumptionStatusPill, BriefStatusPill, DecisionStatusPill } from '../components/StatusPill';
import { useToast } from '../components/Toast';
import { SOURCE_LABEL, userName } from '../lib/describe';
import { formatConfidence, formatDate, formatDateTime, formatDayMonth, formatLongDate } from '../lib/format';
import { visibleBriefs, visibleDecision } from '../state/selectors';
import { useStore } from '../state/store';

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2 border-t border-slate-200 py-3 print:break-inside-avoid">
      <span className="pt-px font-mono text-[11px] text-slate-400">{String(n).padStart(2, '0')}</span>
      <div>
        <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export default function ReopenBriefScreen() {
  const { state, dispatch, user } = useStore();
  const toast = useToast();
  if (state.screen.name !== 'brief' || !user) return null;
  const briefId = state.screen.briefId;
  const brief = visibleBriefs(state, user).find((b) => b.id === briefId);
  if (!brief) return null;
  const decision = visibleDecision(state, user, brief.decisionId)!;
  const evidence = state.evidence[brief.triggeringEvidenceId];
  const names = brief.notifyList.map((id) => userName(state.users, id));

  const notify = () => {
    dispatch({ type: 'brief/notify', briefId: brief.id, actorId: user.id });
    toast('success', `Brief ${brief.id} sent to ${names.join(' and ')}. Demo only, no message left this browser.`);
  };
  const actioned = () => {
    dispatch({ type: 'brief/actioned', briefId: brief.id, actorId: user.id });
    toast('success', `Brief ${brief.id} marked as actioned.`);
  };

  return (
    <div className="mx-auto max-w-[860px] space-y-3 print:max-w-none">
      <div className="flex items-center gap-2 print:hidden">
        <button type="button" onClick={() => dispatch({ type: 'navigate', screen: { name: 'decision', decisionId: decision.id } })}
          className="inline-flex items-center gap-0.5 rounded px-1 text-[12px] text-slate-500 hover:bg-slate-200/60 hover:text-slate-800">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> {decision.id}
        </button>
        <BriefStatusPill status={brief.status} />
        {brief.sentOn && <span className="text-[12px] text-slate-500">Sent {formatDateTime(brief.sentOn)}</span>}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn-quiet h-8" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" aria-hidden /> Print
          </button>
          {brief.status === 'sent' && (
            <button type="button" className="btn-quiet h-8" onClick={actioned}>
              <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Mark actioned
            </button>
          )}
          <button type="button" className="btn-primary h-8" onClick={notify} disabled={brief.status !== 'draft'}>
            <Send className="h-3.5 w-3.5" aria-hidden /> {brief.status === 'draft' ? 'Notify stakeholders' : 'Stakeholders notified'}
          </button>
        </div>
      </div>

      <article className="rounded-md border border-slate-200 bg-white px-8 py-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start gap-4 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-broken-700">
              Reopen brief <span className="font-mono font-normal tracking-normal text-slate-400">{brief.id}</span>
            </div>
            <h1 className="mt-1 text-[19px] font-semibold leading-tight tracking-tight text-slate-900">{decision.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
              <span className="font-mono">{decision.id}</span>
              <DecisionStatusPill status={decision.status} size="sm" />
              <span>Owner {userName(state.users, decision.owner)}</span>
              <span>Drafted {formatDateTime(brief.createdOn)}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-1.5 text-[12px] font-semibold text-slate-900">
              <BrandMark className="h-4 w-4 text-accent-600" /> Rethread
            </div>
            <div className="text-[11px] text-slate-500">Calder Group</div>
          </div>
        </header>

        <Section n={1} title="What changed">
          <p className="leading-relaxed text-slate-800">{brief.whatChanged}</p>
          {evidence && (
            <p className="mt-1 text-[11.5px] text-slate-500">
              Source: {SOURCE_LABEL[evidence.source]} {evidence.id}, received {formatLongDate(evidence.receivedOn)}, submitted by {userName(state.users, evidence.submittedBy)}.
            </p>
          )}
        </Section>

        <Section n={2} title="Assumptions broken">
          <table className="w-full text-left">
            <tbody>
              {brief.brokenAssumptions.map((b) => (
                <tr key={b.assumptionId} className="align-top">
                  <td className="w-14 py-0.5 font-mono text-[11.5px] text-slate-500">{b.assumptionId}</td>
                  <td className="py-0.5 pr-3">
                    <div className="font-medium text-slate-900">{b.statement}</div>
                    <div className="text-[12px] text-slate-600">{b.rationale}</div>
                  </td>
                  <td className="w-40 whitespace-nowrap py-0.5 text-right">
                    <span className="inline-flex items-center gap-1"><AssumptionStatusPill status={b.fromStatus} size="sm" /> <span className="text-slate-400">to</span> <AssumptionStatusPill status={b.toStatus} size="sm" /></span>
                    <div className="text-[11px] tabular-nums text-slate-500">confidence {formatConfidence(b.confidence)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section n={3} title="Decisions affected">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-6 text-[12.5px]">
            <span className="truncate font-medium text-slate-900"><span className="mr-1.5 font-mono text-[11.5px] font-normal text-slate-500">{decision.id}</span>{decision.title}</span>
            <span className="text-slate-500">Value at risk <Money value={decision.valueAtRisk} className="font-semibold text-slate-900" /></span>
            <span className="text-slate-500">Review <span className="font-semibold text-slate-900">{formatDate(decision.reviewDate)}</span></span>
            {brief.relatedDecisionIds.map((id) => (
              <span key={id} className="col-span-3 text-slate-600"><span className="mr-1.5 font-mono text-[11.5px] text-slate-500">{id}</span>{state.decisions[id]?.title} (same signal)</span>
            ))}
          </div>
          <p className="mt-1.5 text-slate-700">{brief.impactStatement}</p>
        </Section>

        <Section n={4} title="Options now live again">
          {brief.revivedOptions.length === 0 && <p className="text-slate-600">None of the rejected options is favourable on the new figures.</p>}
          <div className="space-y-2">
            {brief.revivedOptions.map((r) => {
              const o = state.rejectedOptions[r.optionId]!;
              return (
                <div key={r.optionId} className="rounded border border-accent-500/40 bg-accent-50/50 px-3 py-2 print:bg-white">
                  <div className="flex items-baseline gap-2">
                    <span className="rounded bg-accent-600 px-1.5 text-[10px] font-semibold uppercase leading-4 tracking-wide text-white print:border print:border-slate-900 print:bg-white print:text-slate-900">Live again</span>
                    <span className="font-semibold text-slate-900"><span className="mr-1 font-mono text-[11.5px] font-normal text-slate-500">{o.id}</span>{o.title}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-4 text-[12.5px]">
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Rejected because</div>
                      <p className="text-slate-500 line-through decoration-slate-500 decoration-[1.5px]">{o.rejectedBecause}</p>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Now</div>
                      <p className="font-medium text-slate-900">{r.newComparison ? `${r.newComparison.text}.` : r.whyItIsLiveAgain}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {brief.consideredOptions.map((c) => {
              const o = state.rejectedOptions[c.optionId]!;
              return (
                <p key={c.optionId} className="text-[12px] text-slate-500">
                  <span className="mr-1 font-mono text-[11px]">{o.id}</span><span className="text-slate-700">{o.title}</span> checked and still closed. Rejected because {o.rejectedBecause.charAt(0).toLowerCase() + o.rejectedBecause.slice(1)}
                </p>
              );
            })}
          </div>
        </Section>

        <Section n={5} title="Notify list">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {brief.notifyList.map((id) => {
              const u = state.users[id];
              return (
                <li key={id} className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-white print:border print:border-slate-800 print:bg-white print:text-slate-900">{u?.avatarInitials}</span>
                  <span className="text-slate-900">{u?.name}</span>
                  <span className="text-[11.5px] text-slate-500">{u ? (id === decision.owner ? 'Owner' : ROLE_LABEL[u.role]) : ''}</span>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section n={6} title="Recommended next step">
          <div className="flex items-start gap-3 rounded border-l-4 border-slate-900 bg-slate-50 px-3 py-2 print:bg-white">
            <p className="flex-1 text-[13.5px] font-medium leading-snug text-slate-900">{brief.recommendedNextStep}</p>
            {brief.actionBy && (
              <div className="shrink-0 text-right">
                <div className="flex items-center justify-end gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500"><CalendarClock className="h-3 w-3" aria-hidden /> Act by</div>
                <div className="text-[16px] font-semibold text-slate-900">{formatDayMonth(brief.actionBy)}</div>
              </div>
            )}
          </div>
        </Section>

        <footer className="border-t border-slate-200 pt-2 text-[10.5px] text-slate-400">
          Drafted by the Rethread agent from {brief.triggeringEvidenceId}
          {evidence?.analysis ? `, ${evidence.analysis.engine === 'llm' ? 'LLM' : 'local'} engine` : ''}. For discussion; the decision stays with its owner.
        </footer>
      </article>
    </div>
  );
}
