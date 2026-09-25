// Evidence list, newest first, with the assumptions each item touched and the verdicts. Bodies expand in place.
import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import type { Evidence, User, UserId, Verdict } from '../types';
import { SOURCE_LABEL, userName } from '../lib/describe';
import { formatConfidence, formatDate } from '../lib/format';

const VERDICT: Record<Verdict, { icon: typeof CheckCircle2; cls: string }> = {
  supports: { icon: CheckCircle2, cls: 'text-holding-700' },
  contradicts: { icon: XCircle, cls: 'text-broken-700' },
  neutral: { icon: MinusCircle, cls: 'text-slate-500' },
};

export function EvidenceTimeline({ evidence, users }: { evidence: Evidence[]; users: Record<UserId, User> }) {
  return (
    <section className="card" aria-label="Evidence">
      <header className="card-header">
        <h2 className="card-title">Evidence</h2>
        <span className="text-[11.5px] text-slate-500">{evidence.length} item{evidence.length === 1 ? '' : 's'}, newest first</span>
      </header>
      {evidence.length === 0 ? (
        <p className="px-4 py-3 text-[12px] text-slate-500">No evidence has touched this decision yet.</p>
      ) : (
        <ol className="px-4 py-2">
          {evidence.map((e, i) => (
            <li key={e.id} className="relative flex gap-3 pb-3 last:pb-1">
              {i < evidence.length - 1 && <span className="absolute left-[3px] top-3 h-full w-px bg-slate-200" aria-hidden />}
              <span className="relative mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-slate-400 ring-2 ring-white" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11.5px] tabular-nums text-slate-500">{formatDate(e.receivedOn)}</span>
                  <span className="text-[11px] text-slate-400">{SOURCE_LABEL[e.source]}</span>
                  <span className="ml-auto font-mono text-[11px] text-slate-400">{e.id}</span>
                </div>
                <details className="group">
                  <summary className="cursor-pointer list-none font-medium leading-snug text-slate-900 hover:text-accent-700 [&::-webkit-details-marker]:hidden">
                    {e.title}
                  </summary>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 px-2.5 py-2 font-sans text-[12px] leading-[1.5] text-slate-600">{e.body}</pre>
                  <div className="mt-1 text-[11px] text-slate-400">Submitted by {userName(users, e.submittedBy)}</div>
                </details>
                <ul className="mt-1 space-y-0.5">
                  {e.findings.map((f) => {
                    const V = VERDICT[f.verdict];
                    return (
                      <li key={f.assumptionId} className="flex items-start gap-1.5 text-[12px]">
                        <V.icon className={`mt-px h-3.5 w-3.5 shrink-0 ${V.cls}`} aria-label={f.verdict} />
                        <span className="font-mono text-[11px] text-slate-500">{f.assumptionId}</span>
                        <span className={`${V.cls}`}>{f.verdict}</span>
                        <span className="tabular-nums text-slate-400">{formatConfidence(f.confidence)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
