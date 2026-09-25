// Frame for the two login steps: product panel on the left, the step's form on the right, plus the shared error and lockout notices.
import type { ReactNode } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { LOCKOUT_MS, MAX_ATTEMPTS } from '../lib/auth';
import type { AuthError } from '../types';
import { BrandMark } from './BrandMark';

export function AuthLayout({ step, title, subtitle, children }: { step: 1 | 2; title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-[420px] shrink-0 flex-col justify-between bg-slate-900 px-10 py-9 text-slate-300 lg:flex">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-6 w-6 text-accent-500" />
          <span className="text-[15px] font-semibold tracking-tight text-white">Rethread</span>
        </div>
        <div>
          <p className="text-[22px] font-semibold leading-snug tracking-tight text-white">
            Every decision rests on assumptions. Rethread notices when one stops being true.
          </p>
          <dl className="mt-8 space-y-3 text-[12.5px]">
            {[
              ['Watches', 'the assumptions underneath past decisions'],
              ['Reopens', 'the decision when new evidence contradicts one'],
              ['Resurfaces', 'the options rejected at the time, and why'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-20 shrink-0 font-medium text-white">{k}</dt>
                <dd className="text-slate-400">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="text-[11px] text-slate-500">Calder Group internal. Prototype running offline in this browser.</div>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-[360px]">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <BrandMark className="h-5 w-5 text-accent-600" />
            <span className="font-semibold">Rethread</span>
          </div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Step {step} of 2
            <span className="ml-1 flex gap-1" aria-hidden>
              <span className={`h-1 w-5 rounded-full ${step >= 1 ? 'bg-accent-600' : 'bg-slate-300'}`} />
              <span className={`h-1 w-5 rounded-full ${step >= 2 ? 'bg-accent-600' : 'bg-slate-300'}`} />
            </span>
          </div>
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Error, or lockout with a countdown. Renders nothing when there is nothing to say. */
export function AuthNotice({ error, lockSeconds, what }: { error: AuthError | null; lockSeconds: number; what: string }) {
  if (lockSeconds > 0) {
    return (
      <div role="alert" className="flex gap-2.5 rounded border border-broken-500/40 bg-broken-50 px-3 py-2.5 text-broken-700">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex-1">
          <div className="font-medium">Too many failed attempts</div>
          <div className="text-[12px]">Sign in is locked for {lockSeconds} more second{lockSeconds === 1 ? '' : 's'}.</div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-broken-500/20">
            <div className="h-full bg-broken-500 transition-[width] duration-200" style={{ width: `${(lockSeconds * 1000 * 100) / LOCKOUT_MS}%` }} />
          </div>
        </div>
      </div>
    );
  }
  if (!error || error.kind === 'locked') return null;
  return (
    <div role="alert" className="flex gap-2.5 rounded border border-broken-500/40 bg-broken-50 px-3 py-2.5 text-broken-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <div className="font-medium">{what}</div>
        <div className="text-[12px]">
          {error.attemptsLeft} of {MAX_ATTEMPTS} attempts left before a {LOCKOUT_MS / 1000} second lockout.
        </div>
      </div>
    </div>
  );
}
