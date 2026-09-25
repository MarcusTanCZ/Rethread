// Dashboard metric tile: label, right aligned tabular value, optional sub caption and a status accent when it needs attention.
import type { ReactNode } from 'react';

export function MetricTile({ label, value, caption, attention }: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  /** Colours the value with a status colour; only for tiles that count a status. */
  attention?: 'amber' | 'red';
}) {
  const valueColour = attention === 'red' ? 'text-broken-700' : attention === 'amber' ? 'text-shaky-700' : 'text-slate-900';
  return (
    <div className="card relative min-w-0 overflow-hidden px-3.5 py-2.5">
      {attention && <span className={`absolute inset-x-0 top-0 h-0.5 ${attention === 'red' ? 'bg-broken-500' : 'bg-shaky-500'}`} aria-hidden />}
      <div className="truncate text-[11px] font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 text-right text-[20px] font-semibold leading-7 tracking-tight tabular-nums ${valueColour}`}>{value}</div>
      {caption && <div className="truncate text-right text-[11px] text-slate-500">{caption}</div>}
    </div>
  );
}
