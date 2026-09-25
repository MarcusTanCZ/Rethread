import { describe, expect, it } from 'vitest';
import { createSeedState } from './initialState';
import { loadState, saveState, SCHEMA_VERSION, STORAGE_KEY, type KeyValueStore } from './persistence';
import { reducer } from './reducer';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

describe('persistence', () => {
  it('round trips state', () => {
    const store = memoryStore();
    const state = createSeedState();
    expect(saveState(state, store)).toBe(true);
    const loaded = loadState(store);
    expect(loaded.status).toBe('loaded');
    expect(loaded.status === 'loaded' && loaded.state).toEqual(state);
  });

  it('reports empty storage', () => {
    expect(loadState(memoryStore()).status).toBe('empty');
    expect(loadState(null).status).toBe('empty');
  });

  it('wipes state from another schema version instead of loading it', () => {
    const old = { ...createSeedState(), schemaVersion: SCHEMA_VERSION - 1 };
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify(old) });
    expect(loadState(store)).toEqual({ status: 'discarded', reason: 'version-mismatch' });
    expect(store.data[STORAGE_KEY]).toBeUndefined();
  });

  it('wipes corrupt JSON and partial shapes', () => {
    const corrupt = memoryStore({ [STORAGE_KEY]: '{not json' });
    expect(loadState(corrupt)).toEqual({ status: 'discarded', reason: 'corrupt' });
    expect(corrupt.data[STORAGE_KEY]).toBeUndefined();

    const partial = memoryStore({ [STORAGE_KEY]: JSON.stringify({ schemaVersion: SCHEMA_VERSION, decisions: {} }) });
    expect(loadState(partial)).toEqual({ status: 'discarded', reason: 'corrupt' });
  });

  it('never throws when storage is blocked or full', () => {
    const hostile: KeyValueStore = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => { throw new Error('SecurityError'); },
    };
    expect(loadState(hostile).status).toBe('empty');
    expect(saveState(createSeedState(), hostile)).toBe(false);
  });
});

describe('reset', () => {
  it('restores the seed exactly while keeping the session and API key', () => {
    let state = createSeedState();
    state = {
      ...state,
      session: { ...state.session, stage: 'authenticated', userId: 'U-01' },
      settings: { ...state.settings, engine: 'llm', traceStepMs: 50, llm: { ...state.settings.llm, apiKey: 'sk-test' } },
    };
    state.decisions['D-07']!.status = 'reopen';
    state.assumptions['A-104']!.status = 'broken';
    delete state.evidence['E-01'];

    const after = reducer(state, { type: 'reset' });
    const seed = createSeedState();
    for (const k of ['users', 'decisions', 'assumptions', 'rejectedOptions', 'evidence', 'briefs'] as const) {
      expect(after[k]).toEqual(seed[k]);
    }
    expect(after.settings.engine).toBe('local');
    expect(after.settings.traceStepMs).toBe(400);
    expect(after.settings.llm.apiKey).toBe('sk-test');
    expect(after.session.userId).toBe('U-01');
    expect(after.screen).toEqual({ name: 'portfolio' });
    expect(after.lastRun).toBeNull();
  });
});

describe('navigation guard', () => {
  const signedIn = (userId: string) => {
    const s = createSeedState();
    return { ...s, session: { ...s.session, stage: 'authenticated' as const, userId } };
  };

  it('keeps signed out sessions on login', () => {
    expect(reducer(createSeedState(), { type: 'navigate', screen: { name: 'portfolio' } }).screen).toEqual({ name: 'login' });
  });

  it('sends an owner away from the portfolio and from decisions they do not own', () => {
    const s = signedIn('U-02');
    expect(reducer(s, { type: 'navigate', screen: { name: 'portfolio' } }).screen).toEqual({ name: 'my-decisions' });
    expect(reducer(s, { type: 'navigate', screen: { name: 'decision', decisionId: 'D-01' } }).screen).toEqual({ name: 'my-decisions' });
    expect(reducer(s, { type: 'navigate', screen: { name: 'decision', decisionId: 'D-07' } }).screen).toEqual({ name: 'decision', decisionId: 'D-07' });
  });

  it('keeps a contributor out of the portfolio, inbox, settings and D-07', () => {
    const s = signedIn('U-03');
    for (const name of ['portfolio', 'inbox', 'settings'] as const) {
      expect(reducer(s, { type: 'navigate', screen: { name } }).screen).toEqual({ name: 'contributor' });
    }
    expect(reducer(s, { type: 'navigate', screen: { name: 'decision', decisionId: 'D-07' } }).screen).toEqual({ name: 'contributor' });
    expect(reducer(s, { type: 'navigate', screen: { name: 'decision', decisionId: 'D-10' } }).screen).toEqual({ name: 'decision', decisionId: 'D-10' });
  });
});
