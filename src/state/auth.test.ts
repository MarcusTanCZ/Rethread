import { describe, expect, it } from 'vitest';
import { acceptedCodes, LOCKOUT_MS, mfaCodeFor, secondsUntilRotation } from '../lib/auth';
import type { AppState } from '../types';
import { createSeedState } from './initialState';
import { reducer } from './reducer';

const T0 = Date.parse('2026-09-25T09:00:05+08:00');
const MIN = 60_000;

const pw = (s: AppState, username: string, password: string, at = T0) => reducer(s, { type: 'auth/password', username, password, at });
const code = (s: AppState, c: string, at = T0) => reducer(s, { type: 'auth/code', code: c, at });
const wrongCode = (c: string) => (c === '000000' ? '111111' : '000000');

describe('MFA code', () => {
  it('is six digits and stable within a minute', () => {
    expect(mfaCodeFor(T0)).toMatch(/^\d{6}$/);
    expect(mfaCodeFor(T0 + 50_000)).toBe(mfaCodeFor(T0));
  });

  it('changes from minute to minute', () => {
    const codes = new Set(Array.from({ length: 60 }, (_, i) => mfaCodeFor(T0 + i * MIN)));
    expect(codes.size).toBeGreaterThan(55);
  });

  it('accepts the current and previous minute only', () => {
    expect(acceptedCodes(T0 + MIN)).toEqual([mfaCodeFor(T0 + MIN), mfaCodeFor(T0)]);
    expect(acceptedCodes(T0 + 2 * MIN)).not.toContain(mfaCodeFor(T0));
  });

  it('counts down to the next rotation', () => {
    expect(secondsUntilRotation(Date.parse('2026-09-25T09:00:05Z'))).toBe(55);
  });
});

describe('two step login', () => {
  it('signs each seeded user in and lands on their home screen', () => {
    for (const [username, userId, home] of [['ceo', 'U-01', 'portfolio'], ['jlim', 'U-02', 'my-decisions'], ['DTAN ', 'U-03', 'contributor']] as const) {
      const s1 = pw(createSeedState(), username, 'demo1234');
      expect(s1.session).toMatchObject({ stage: 'mfa', pendingUserId: userId, error: null });
      expect(s1.screen).toEqual({ name: 'mfa' });
      const s2 = code(s1, mfaCodeFor(T0));
      expect(s2.session).toMatchObject({ stage: 'authenticated', userId, pendingUserId: null });
      expect(s2.screen).toEqual({ name: home });
    }
  });

  it('shows a wrong password error with attempts left, without revealing which field was wrong', () => {
    const s = pw(createSeedState(), 'ceo', 'nope');
    expect(s.session).toMatchObject({ stage: 'password', userId: null, error: { kind: 'bad-credentials', attemptsLeft: 2 } });
    expect(pw(createSeedState(), 'nobody', 'demo1234').session.error).toEqual(s.session.error);
  });

  it('shows a wrong code error and stays on the MFA step', () => {
    const s1 = pw(createSeedState(), 'ceo', 'demo1234');
    const s2 = code(s1, wrongCode(mfaCodeFor(T0)));
    expect(s2.session).toMatchObject({ stage: 'mfa', userId: null, error: { kind: 'bad-code', attemptsLeft: 2 } });
  });

  it('ignores a code when no password step has passed', () => {
    const s = createSeedState();
    expect(code(s, mfaCodeFor(T0))).toBe(s);
  });
});

describe('lockout', () => {
  it('locks after three failures across both steps and blocks even correct input', () => {
    let s = pw(createSeedState(), 'ceo', 'bad1');
    s = pw(s, 'ceo', 'demo1234');
    s = code(s, wrongCode(mfaCodeFor(T0)));
    expect(s.session.error).toMatchObject({ kind: 'bad-code', attemptsLeft: 1 });
    s = code(s, wrongCode(mfaCodeFor(T0)));
    expect(s.session.error).toEqual({ kind: 'locked', attemptsLeft: 0 });
    expect(s.session.lockout.lockedUntil).toBe(T0 + LOCKOUT_MS);

    const blocked = code(s, mfaCodeFor(T0), T0 + 5_000);
    expect(blocked.session.stage).toBe('mfa');
    expect(blocked.session.error?.kind).toBe('locked');
  });

  it('clears after ten seconds and starts counting from zero again', () => {
    let s = createSeedState();
    for (let i = 0; i < 3; i++) s = pw(s, 'ceo', 'bad');
    expect(s.session.error?.kind).toBe('locked');

    const retry = pw(s, 'ceo', 'bad', T0 + LOCKOUT_MS);
    expect(retry.session.error).toEqual({ kind: 'bad-credentials', attemptsLeft: 2 });

    const ok = pw(s, 'ceo', 'demo1234', T0 + LOCKOUT_MS + 1);
    expect(ok.session).toMatchObject({ stage: 'mfa', lockout: { failedAttempts: 0, lockedUntil: null } });
  });

  it('resets the counter on a successful sign in', () => {
    let s = pw(createSeedState(), 'ceo', 'bad');
    s = pw(s, 'ceo', 'demo1234');
    s = code(s, mfaCodeFor(T0));
    expect(s.session.lockout).toEqual({ failedAttempts: 0, lockedUntil: null });
  });
});

describe('sign out and role switch', () => {
  it('signs out to login with the chosen username prefilled', () => {
    const signedIn = code(pw(createSeedState(), 'ceo', 'demo1234'), mfaCodeFor(T0));
    const s = reducer(signedIn, { type: 'auth/logout', hint: 'dtan' });
    expect(s.session).toMatchObject({ stage: 'password', userId: null, loginHint: 'dtan' });
    expect(s.screen).toEqual({ name: 'login' });
    expect(reducer(s, { type: 'navigate', screen: { name: 'portfolio' } }).screen).toEqual({ name: 'login' });
  });

  it('goes back from MFA to credentials', () => {
    const s = reducer(pw(createSeedState(), 'ceo', 'demo1234'), { type: 'auth/back' });
    expect(s.session).toMatchObject({ stage: 'password', pendingUserId: null });
    expect(s.screen).toEqual({ name: 'login' });
  });
});
