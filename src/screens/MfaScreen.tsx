// Login step 2: 6 digit MFA code entry with demo mode box, error and lockout states.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { AuthLayout, AuthNotice } from '../components/AuthLayout';
import { DemoCode } from '../components/DemoModeBox';
import { lockSecondsLeft } from '../lib/auth';
import { useNow } from '../lib/useNow';
import { useStore } from '../state/store';

export default function MfaScreen() {
  const { state, dispatch } = useStore();
  const { session } = state;
  const pending = session.pendingUserId ? state.users[session.pendingUserId] : undefined;
  const now = useNow();
  const lockSeconds = lockSecondsLeft(session.lockout, now);
  const locked = lockSeconds > 0;

  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session.error) return;
    setCode('');
  }, [session.error]);

  // Refocus whenever the field becomes usable again (first render, after an error, after lockout).
  useEffect(() => {
    if (!locked) inputRef.current?.focus();
  }, [locked, session.error]);

  const submitCode = (value: string) => {
    if (locked || value.length !== 6) return;
    dispatch({ type: 'auth/code', code: value, at: Date.now() });
  };

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) submitCode(digits);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    submitCode(code);
  };

  return (
    <AuthLayout
      step={2}
      title="Verify it's you"
      subtitle={
        <>
          Enter the 6 digit code from your authenticator app.
          {pending ? <> Signing in as <span className="font-medium text-slate-700">{pending.name}</span>.</> : null}
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="code" className="label">Verification code</label>
          <input id="code" ref={inputRef} className="field h-11 text-center font-mono text-[20px] tracking-[0.5em]"
            inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code}
            onChange={(e) => onChange(e.target.value)} disabled={locked} aria-invalid={session.error?.kind === 'bad-code'} />
        </div>

        <AuthNotice error={session.error} lockSeconds={lockSeconds} what="That code is not valid" />

        <button type="submit" className="btn-primary w-full" disabled={locked || code.length !== 6}>
          <ShieldCheck className="h-4 w-4" aria-hidden /> Verify and sign in
        </button>
        <button type="button" className="btn w-full text-slate-600 hover:bg-slate-200/60" onClick={() => dispatch({ type: 'auth/back' })}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Use a different account
        </button>
      </form>

      <div className="mt-6">
        <DemoCode now={now} onUse={(c) => onChange(c)} disabled={locked} />
      </div>
    </AuthLayout>
  );
}
