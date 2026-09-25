// Default settings and session, and createSeedState(): the exact state Reset demo restores.
import type { AppState, Session, Settings } from '../types';
import { buildSeed } from '../data/seed';
import { SCHEMA_VERSION } from './persistence';

export function defaultSettings(): Settings {
  return {
    engine: 'local',
    llm: { apiKey: '', endpoint: '', model: '', timeoutMs: 12_000 },
    thresholds: { broken: 0.75, shaky: 0.4, shakyMargin: 0.03 },
    traceStepMs: 400,
  };
}

export function signedOutSession(loginHint: string | null = null): Session {
  return {
    stage: 'password',
    pendingUserId: null,
    userId: null,
    lockout: { failedAttempts: 0, lockedUntil: null },
    error: null,
    loginHint,
  };
}

export function createSeedState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    ...buildSeed(),
    settings: defaultSettings(),
    session: signedOutSession(),
    screen: { name: 'login' },
    lastRun: null,
    epoch: 0,
    inboxPreload: null,
  };
}
