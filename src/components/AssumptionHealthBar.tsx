// Small stacked SVG bar of holding / shaky / broken assumption counts.
import type { AssumptionHealth } from '../types';

const W = 72;
const H = 6;

export function AssumptionHealthBar({ health }: { health: AssumptionHealth }) {
  const total = health.holding + health.shaky + health.broken || 1;
  const segs: [number, string][] = [
    [health.holding, 'fill-holding-500'],
    [health.shaky, 'fill-shaky-500'],
    [health.broken, 'fill-broken-500'],
  ];
  let x = 0;
  const label = `${health.holding} holding, ${health.shaky} shaky, ${health.broken} broken`;
  return (
    <span className="inline-flex items-center gap-2" title={label}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="shrink-0 overflow-hidden rounded-full">
        <rect width={W} height={H} className="fill-slate-200" />
        {segs.map(([n, cls], i) => {
          const w = (n / total) * W;
          const r = <rect key={i} x={x} width={Math.max(0, w - (x + w < W - 0.5 ? 1 : 0))} height={H} className={cls} />;
          x += w;
          return n ? r : null;
        })}
      </svg>
      <span className="w-12 text-[11px] text-slate-500">
        {health.holding}
        <span className="text-slate-300">/</span>
        <span className={health.shaky ? 'text-shaky-700' : ''}>{health.shaky}</span>
        <span className="text-slate-300">/</span>
        <span className={health.broken ? 'font-semibold text-broken-700' : ''}>{health.broken}</span>
      </span>
    </span>
  );
}
