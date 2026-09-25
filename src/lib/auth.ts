// Credential check, deterministic minute based MFA code, and the 3 attempt / 10 second lockout logic.
//
// Everything takes the current time as an argument so the reducer stays pure and tests can
// drive the clock. MFA uses the real wall clock (it must rotate during a demo); the demo date
// in lib/clock is only for business dates.
import type { Lockout, User } from '../types';

export const MAX_ATTEMPTS = 3;
export const LOCKOUT_MS = 10_000;
const MINUTE_MS = 60_000;

/* ------------------------------------------------------------------ MFA */

/** A 6 digit code for the minute containing `ms`. Deterministic; prototype only. */
export function mfaCodeFor(ms: number): string {
  let x = Math.floor(ms / MINUTE_MS) ^ 0x5bd1e995;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
  x ^= x >>> 15;
  return String((x >>> 0) % 1_000_000).padStart(6, '0');
}

/**
 * The current minute's code and the previous minute's, so a code read just before the
 * minute turns over still works (DECISIONS.md).
 */
export function acceptedCodes(ms: number): string[] {
  return [mfaCodeFor(ms), mfaCodeFor(ms - MINUTE_MS)];
}

export function secondsUntilRotation(ms: number): number {
  return Math.ceil((MINUTE_MS - (ms % MINUTE_MS)) / 1000);
}

/* ------------------------------------------------------------------ credentials */

export function findUserByCredentials(users: Record<string, User>, username: string, password: string): User | null {
  const name = username.trim().toLowerCase();
  const user = Object.values(users).find((u) => u.username.toLowerCase() === name);
  return user && user.password === password ? user : null;
}

/* ------------------------------------------------------------------ lockout */

export const noLockout = (): Lockout => ({ failedAttempts: 0, lockedUntil: null });

export function isLocked(l: Lockout, ms: number): boolean {
  return l.lockedUntil !== null && ms < l.lockedUntil;
}

export function lockSecondsLeft(l: Lockout, ms: number): number {
  // Capped, because a UI clock that ticks a moment behind the dispatch time would show 11.
  return isLocked(l, ms) ? Math.min(LOCKOUT_MS / 1000, Math.ceil((l.lockedUntil! - ms) / 1000)) : 0;
}

/** Clears a lock whose ten seconds have passed, so the next attempt starts from zero. */
export function expireLockout(l: Lockout, ms: number): Lockout {
  return l.lockedUntil !== null && ms >= l.lockedUntil ? noLockout() : l;
}

/** Records a failed attempt. The third failure locks for LOCKOUT_MS. */
export function registerFailure(l: Lockout, ms: number): Lockout {
  const failedAttempts = l.failedAttempts + 1;
  return failedAttempts >= MAX_ATTEMPTS ? { failedAttempts, lockedUntil: ms + LOCKOUT_MS } : { failedAttempts, lockedUntil: null };
}
