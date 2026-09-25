// Safe localStorage read/write wrappers keyed by schema version, tolerant of quota errors and corrupt JSON.
import type { AppState } from '../types';

export const STORAGE_KEY = 'rethread:state';

/**
 * Bump whenever the persisted shape of AppState or the seed changes. A stored state with any
 * other version is discarded on load, so stale data is wiped instead of crashing the app.
 */
export const SCHEMA_VERSION = 3;

/** The subset of the Storage API we use, so tests can pass an in-memory fake. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** window.localStorage, or null where it is missing or blocked (private mode, sandboxed file://). */
export function browserStorage(): KeyValueStore | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__rethread_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function looksLikeState(v: unknown): v is AppState {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    s.schemaVersion === SCHEMA_VERSION &&
    ['users', 'decisions', 'assumptions', 'rejectedOptions', 'evidence', 'briefs', 'settings', 'session', 'screen'].every(
      (k) => s[k] !== null && typeof s[k] === 'object',
    )
  );
}

export type LoadResult =
  | { status: 'loaded'; state: AppState }
  | { status: 'empty' }
  | { status: 'discarded'; reason: 'version-mismatch' | 'corrupt' };

/** Reads persisted state. Anything unreadable or from another schema version is removed. */
export function loadState(storage: KeyValueStore | null = browserStorage()): LoadResult {
  if (!storage) return { status: 'empty' };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'empty' };
  }
  if (raw === null) return { status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearState(storage);
    return { status: 'discarded', reason: 'corrupt' };
  }

  if (looksLikeState(parsed)) return { status: 'loaded', state: parsed };

  const versionMismatch =
    !!parsed && typeof parsed === 'object' && (parsed as { schemaVersion?: unknown }).schemaVersion !== SCHEMA_VERSION;
  clearState(storage);
  return { status: 'discarded', reason: versionMismatch ? 'version-mismatch' : 'corrupt' };
}

/** Writes state. Returns false (and never throws) if storage is unavailable or full. */
export function saveState(state: AppState, storage: KeyValueStore | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(storage: KeyValueStore | null = browserStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: storage is blocked, so there is nothing stale to clear either.
  }
}
