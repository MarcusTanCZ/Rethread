// Dashed demo mode box: the current MFA code with its rotation countdown, or the demo accounts on the credentials step.
import type { ReactNode } from 'react';
import { mfaCodeFor, secondsUntilRotation } from '../lib/auth';

export function DemoModeBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-slate-400 bg-slate-50 px-3 py-2.5" role="note" aria-label="Demo mode">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Demo mode</div>
      {children}
    </div>
  );
}

/** Current code in large type, a countdown bar, and a button that fills the code in. */
export function DemoCode({ now, onUse, disabled }: { now: number; onUse: (code: string) => void; disabled?: boolean }) {
  const code = mfaCodeFor(now);
  const left = secondsUntilRotation(now);
  return (
    <DemoModeBox>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] text-slate-500">Current code</div>
          <div className="font-mono text-[22px] font-semibold leading-tight tracking-[0.18em] text-slate-900" aria-live="polite">
            {code.slice(0, 3)} {code.slice(3)}
          </div>
        </div>
        <button type="button" className="btn-quiet h-8 px-2.5" onClick={() => onUse(code)} disabled={disabled}>
          Use code
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-slate-500 transition-[width] duration-200" style={{ width: `${(left / 60) * 100}%` }} />
        </div>
        <span className="shrink-0 whitespace-nowrap text-right tabular-nums">Rotates in {String(left).padStart(2, ' ')}s</span>
      </div>
    </DemoModeBox>
  );
}
