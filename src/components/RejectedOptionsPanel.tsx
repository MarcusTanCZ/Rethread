// Rejected options panel: muted and collapsed while the decision is healthy; when it is reopened, prominent, with each option's original reason struck through beside the comparison that makes it live again.
import { useState } from 'react';
import { Archive, ChevronDown, ChevronRight, Lock, Undo2 } from 'lucide-react';
import type { Assumption, OptionComparison, RejectedOption, VisibleDecision } from '../types';
import { evaluateRevival, type RevivalResult } from '../engine/revival';
import { fmt, formatQuantity, isCurrencyUnit, lowerIsBetter } from '../engine/units';
import { formatDate } from '../lib/format';
import { AssumptionStatusPill } from './StatusPill';

interface Props {
  decision: VisibleDecision;
  options: RejectedOption[];
  assumptions: Record<string, Assumption>;
}

/* ------------------------------------------------------------------ comparison chart */

/**
 * Three bars on a zero based scale: the incumbent when the decision was made, the incumbent
 * now, and this option. A dashed line marks the assumption's limit.
 */
function ComparisonBars({ killer, comparison }: { killer: Assumption; comparison: OptionComparison }) {
  if (killer.test.kind !== 'threshold') return null;
  const t = killer.test;
  const rows = [
    { label: 'Incumbent at decision', value: t.baseline, bar: 'fill-slate-300', text: 'text-slate-500' },
    { label: 'Incumbent now', value: comparison.incumbentValue, bar: 'fill-broken-500', text: 'text-broken-700 font-semibold' },
    { label: 'This option', value: comparison.optionValue, bar: 'fill-accent-600', text: 'text-accent-700 font-semibold' },
  ];
  const max = Math.max(...rows.map((r) => r.value), t.value) * 1.04;
  const W = 220;
  const x = (v: number) => (v / max) * W;
  const q = (v: number) => `${isCurrencyUnit(t.unit) ? 'SGD ' : ''}${fmt(v, t.unit, comparison.incumbentValue, comparison.optionValue, t.baseline)}`;
  const unitTail = isCurrencyUnit(t.unit) ? t.unit.replace(/^SGD\s*/, '') : t.unit;

  return (
    <figure className="mt-2">
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[112px_minmax(0,1fr)_72px] items-center gap-2">
            <span className="truncate text-[11px] text-slate-500">{r.label}</span>
            <svg viewBox={`0 0 ${W} 10`} preserveAspectRatio="none" className="h-2.5 w-full overflow-visible" aria-hidden>
              <rect width={W} height="10" rx="2" className="fill-slate-100" />
              <rect width={x(r.value)} height="10" rx="2" className={r.bar} />
              <line x1={x(t.value)} x2={x(t.value)} y1="-3" y2="13" className="stroke-slate-700" strokeWidth="1.2" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className={`text-right text-[12px] tabular-nums ${r.text}`}>{q(r.value)}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-1.5 text-[10.5px] text-slate-400">
        {unitTail[0]!.toUpperCase() + unitTail.slice(1)}, from zero. Dashed line: the {t.operator === '<=' ? 'ceiling' : 'floor'} of {formatQuantity(t.value, t.unit)} in {killer.id}.
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ option cards */

function LiveOption({ option, killer, result, decidedOn }: { option: RejectedOption; killer: Assumption; result: RevivalResult; decidedOn: string }) {
  const c = result.comparison;
  const betterWord = killer.test.kind === 'threshold'
    ? lowerIsBetter(killer.test.operator) ? (isCurrencyUnit(killer.test.unit) ? 'cheaper' : 'lower') : 'higher'
    : '';
  const pct = c ? Math.abs(c.delta / c.incumbentValue) * 100 : 0;

  return (
    <article className="relative overflow-hidden rounded-md border border-accent-500/40 bg-white shadow-sm shadow-accent-600/5">
      <span className="absolute inset-y-0 left-0 w-1 bg-accent-600" aria-hidden />
      <header className="flex items-start gap-3 px-4 pb-2 pt-3">
        <span className="mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded bg-accent-600 px-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-white">
          <Undo2 className="h-3 w-3" aria-hidden /> Live again
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold leading-snug text-slate-900">
            <span className="mr-1.5 font-mono text-[11.5px] font-normal text-slate-400">{option.id}</span>{option.title}
          </h3>
          <p className="text-[12px] text-slate-500">{option.description}</p>
        </div>
        {c && (
          <div className="shrink-0 text-right">
            <div className="text-[20px] font-semibold leading-none tabular-nums text-accent-700">{pct.toFixed(1)}%</div>
            <div className="text-[11px] text-slate-500">{betterWord} than now</div>
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 gap-0 border-t border-slate-100">
        <div className="border-r border-slate-100 px-4 py-2.5">
          <div className="label mb-1">Rejected {formatDate(decidedOn)} because</div>
          <p className="text-[13px] leading-snug text-slate-500 line-through decoration-slate-500 decoration-[1.5px]">{option.rejectedBecause}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-slate-500">
            <span>That reason rested on</span>
            <span className="font-mono text-slate-700">{killer.id}</span>
            <span>which is now</span>
            <AssumptionStatusPill status={killer.status} size="sm" />
          </div>
          <p className="mt-2 border-t border-slate-100 pt-2 text-[12px] leading-snug text-slate-600">{result.reason}</p>
        </div>
        <div className="px-4 py-2.5">
          <div className="label mb-1">Now</div>
          {c ? (
            <>
              <p className="text-[13px] font-medium leading-snug text-slate-900">{c.text}.</p>
              <ComparisonBars killer={killer} comparison={c} />
            </>
          ) : (
            <p className="text-[13px] font-medium leading-snug text-slate-900">"{killer.statement}" no longer holds, so this option is back on the table.</p>
          )}
        </div>
      </div>
    </article>
  );
}

function ClosedOption({ option, reason, killer, prominentContext }: { option: RejectedOption; reason?: string; killer?: Assumption; prominentContext: boolean }) {
  return (
    <article className={`rounded-md border border-slate-200 px-4 py-2.5 ${prominentContext ? 'bg-slate-50/70' : 'bg-white'}`}>
      <div className="flex items-start gap-3">
        {prominentContext ? (
          <span className="mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded bg-slate-200 px-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
            <Lock className="h-3 w-3" aria-hidden /> Still closed
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className={`font-medium leading-snug ${prominentContext ? 'text-slate-500' : 'text-slate-700'}`}>
            <span className="mr-1.5 font-mono text-[11.5px] font-normal text-slate-400">{option.id}</span>{option.title}
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-500">
            <span className="text-slate-400">Rejected because </span>{option.rejectedBecause}
          </p>
          {prominentContext && reason && <p className="mt-1 text-[12px] text-slate-500"><span className="text-slate-400">Stays closed: </span>{reason}</p>}
        </div>
        {killer && !prominentContext && (
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500" title={killer.statement}>
            depends on <span className="font-mono text-slate-700">{killer.id}</span>
            <AssumptionStatusPill status={killer.status} size="sm" />
          </span>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ panel */

export function RejectedOptionsPanel({ decision, options, assumptions }: Props) {
  const reopened = decision.status === 'reopen';
  const [open, setOpen] = useState(false);
  if (!options.length) return null;

  const killerOf = (o: RejectedOption) => (o.rejectedBecauseAssumptionId ? assumptions[o.rejectedBecauseAssumptionId] : undefined);

  if (reopened) {
    const results = options.map((o) => {
      const killer = killerOf(o);
      return { o, killer, r: evaluateRevival(o, killer, killer?.currentValue) };
    });
    const live = results.filter((x) => x.r.revivable);
    const closed = results.filter((x) => !x.r.revivable);
    return (
      <section className="overflow-hidden rounded-md border-2 border-accent-600/70 bg-accent-50/40" aria-label="Rejected options">
        <header className="flex items-center gap-2.5 border-b border-accent-500/20 bg-white px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-600 text-white"><Undo2 className="h-4 w-4" aria-hidden /></span>
          <div>
            <h2 className="text-[14px] font-semibold text-slate-900">
              {live.length ? `${live.length} rejected option${live.length === 1 ? ' is' : 's are'} live again` : 'No rejected option is live again'}
            </h2>
            <p className="text-[12px] text-slate-500">
              The reason {live.length === 1 ? 'it was' : 'they were'} rejected no longer holds. {closed.length > 0 && `${closed.length} other${closed.length === 1 ? '' : 's'} checked and still closed.`}
            </p>
          </div>
        </header>
        <div className="space-y-2.5 p-3">
          {live.map(({ o, killer, r }) => <LiveOption key={o.id} option={o} killer={killer!} result={r} decidedOn={decision.decidedOn} />)}
          {closed.map(({ o, killer, r }) => (
            <ClosedOption key={o.id} option={o} killer={killer} prominentContext
              reason={killer ? r.reason : 'no tracked assumption covers this reason, so a broken assumption cannot revive it.'} />
          ))}
        </div>
      </section>
    );
  }

  // Healthy or on watch: kept on file, collapsed and muted. Name any option one break away.
  const nearly = options.filter((o) => killerOf(o)?.status === 'shaky');
  return (
    <section className="rounded-md border border-slate-200 bg-slate-50/60" aria-label="Rejected options">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-100/60">
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden /> : <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />}
        <Archive className="h-4 w-4 text-slate-400" aria-hidden />
        <span className="font-medium text-slate-600">Rejected options</span>
        <span className="rounded bg-slate-200 px-1.5 text-[11px] font-medium text-slate-600">{options.length}</span>
        <span className="ml-2 min-w-0 flex-1 truncate text-[12px] text-slate-400">
          {nearly.length
            ? `${nearly.map((o) => o.id).join(', ')} would be rechecked if ${killerOf(nearly[0]!)!.id} breaks`
            : 'Kept on file with the reason each was rejected. Rechecked if the decision reopens.'}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-200 p-3">
          {options.map((o) => <ClosedOption key={o.id} option={o} killer={killerOf(o)} prominentContext={false} />)}
        </div>
      )}
    </section>
  );
}
