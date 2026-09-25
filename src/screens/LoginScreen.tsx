// Login step 1: username and password with error and lockout states.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { AuthLayout, AuthNotice } from '../components/AuthLayout';
import { DemoModeBox } from '../components/DemoModeBox';
import { lockSecondsLeft } from '../lib/auth';
import { useNow } from '../lib/useNow';
import { useStore } from '../state/store';
import { ROLE_LABEL } from '../components/roleLabels';

export default function LoginScreen() {
  const { state, dispatch } = useStore();
  const { session } = state;
  const now = useNow();
  const lockSeconds = lockSecondsLeft(session.lockout, now);
  const locked = lockSeconds > 0;

  const [username, setUsername] = useState(session.loginHint ?? '');
  const [password, setPassword] = useState('');
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (session.loginHint ? passRef : userRef).current?.focus();
  }, [session.loginHint]);

  // After a failed attempt: clear the password and put the cursor back in it.
  useEffect(() => {
    if (!session.error) return;
    setPassword('');
    passRef.current?.focus();
  }, [session.error]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (locked || !username.trim() || !password) return;
    dispatch({ type: 'auth/password', username, password, at: Date.now() });
  };

  const fill = (u: string) => {
    setUsername(u);
    setPassword('demo1234');
  };

  return (
    <AuthLayout step={1} title="Sign in" subtitle="Use your Calder Group account.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="username" className="label">Username</label>
          <input id="username" ref={userRef} className="field" autoComplete="username" value={username}
            onChange={(e) => setUsername(e.target.value)} disabled={locked} spellCheck={false} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" ref={passRef} type="password" className="field" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={locked}
            aria-invalid={session.error?.kind === 'bad-credentials'} />
        </div>

        <AuthNotice error={session.error} lockSeconds={lockSeconds} what="Username or password is incorrect" />

        <button type="submit" className="btn-primary w-full" disabled={locked || !username.trim() || !password}>
          Continue <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </form>

      <div className="mt-6">
        <DemoModeBox>
          <div className="mb-1.5 text-[11px] text-slate-500">Demo accounts, password demo1234. Click to fill.</div>
          <ul className="divide-y divide-slate-200">
            {Object.values(state.users).map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => fill(u.username)} disabled={locked}
                  className="flex w-full items-center gap-3 py-1.5 text-left hover:text-accent-700 disabled:opacity-50">
                  <span className="w-11 font-mono text-[12px] text-slate-900">{u.username}</span>
                  <span className="flex-1 truncate">{u.name}</span>
                  <span className="text-[11px] text-slate-500">{ROLE_LABEL[u.role]}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 border-t border-slate-200 pt-1.5 text-[11px] text-slate-500">
            Press <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">R</kbd> to reset the demo data.
          </div>
        </DemoModeBox>
      </div>
    </AuthLayout>
  );
}
