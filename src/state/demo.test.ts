import { describe, expect, it } from 'vitest';
import { SAMPLE_SIGNALS } from '../data/samples';
import { LocalEngine } from '../engine/localEngine';
import { runAgent } from '../engine/pipeline';
import { canUseDemoControls } from '../lib/useShortcuts';
import type { AppState, DomainData } from '../types';
import { createSeedState } from './initialState';
import { HERO_SAMPLE, reducer } from './reducer';

const domain = (s: AppState): DomainData => {
  const { users, decisions, assumptions, rejectedOptions, evidence, briefs } = s;
  return structuredClone({ users, decisions, assumptions, rejectedOptions, evidence, briefs });
};

const signedIn = (userId: string): AppState => {
  const s = createSeedState();
  return { ...s, session: { ...s.session, stage: 'authenticated', userId }, screen: { name: 'portfolio' } };
};

async function heroRun(state: AppState) {
  const s = SAMPLE_SIGNALS.find((x) => x.key === HERO_SAMPLE)!;
  return runAgent({
    data: state,
    draft: { source: s.source, receivedOn: s.receivedOn, title: s.title, body: s.body },
    submittedBy: 'U-01',
    engine: new LocalEngine(),
    thresholds: state.settings.thresholds,
  });
}

describe('reset', () => {
  it('is idempotent: resetting twice leaves the same data as resetting once, which is the seed', () => {
    const once = reducer(signedIn('U-01'), { type: 'reset' });
    const twice = reducer(once, { type: 'reset' });
    expect(domain(twice)).toEqual(domain(once));
    expect(domain(once)).toEqual(domain(createSeedState()));
    expect(twice.epoch).toBe(once.epoch + 1);
  });

  it('restores the seed exactly after the hero scenario has run and the brief was sent', async () => {
    let s = signedIn('U-01');
    const run = await heroRun(s);
    s = reducer(s, { type: 'agent/applied', run, epoch: s.epoch });
    s = reducer(s, { type: 'brief/notify', briefId: 'RB-01', actorId: 'U-01' });
    expect(s.decisions['D-07']!.status).toBe('reopen');
    const after = reducer(s, { type: 'reset' });
    expect(domain(after)).toEqual(domain(createSeedState()));
    expect(after.lastRun).toBeNull();
  });

  it('discards an agent run that was started before the reset', async () => {
    const s = signedIn('U-01');
    const run = await heroRun(s);
    const reset = reducer(s, { type: 'reset' });
    const late = reducer(reset, { type: 'agent/applied', run, epoch: s.epoch });
    expect(late).toBe(reset);
    expect(late.decisions['D-07']!.status).toBe('active');
  });
});

describe('demo loader', () => {
  it('resets, opens the inbox and preloads the FrostLink notice for the executive', () => {
    const dirty = { ...signedIn('U-01'), inboxPreload: null };
    dirty.decisions['D-07']!.status = 'reopen';
    const s = reducer(dirty, { type: 'demo/loadHero' });
    expect(s.screen).toEqual({ name: 'inbox' });
    expect(s.inboxPreload).toBe('frostlink-rate-notice');
    expect(s.decisions['D-07']!.status).toBe('active');
    expect(reducer(s, { type: 'inbox/preloadConsumed' }).inboxPreload).toBeNull();
  });

  it('never sends a contributor to the inbox', () => {
    const s = reducer(signedIn('U-03'), { type: 'demo/loadHero' });
    expect(s.screen).toEqual({ name: 'contributor' });
    expect(s.inboxPreload).toBeNull();
  });

  it('limits shortcuts to the login screen and the executive', () => {
    const s = createSeedState();
    expect(canUseDemoControls(null)).toBe(true);
    expect(canUseDemoControls(s.users['U-01']!)).toBe(true);
    expect(canUseDemoControls(s.users['U-02']!)).toBe(false);
    expect(canUseDemoControls(s.users['U-03']!)).toBe(false);
  });
});

describe('brief actions', () => {
  async function withBrief(): Promise<AppState> {
    const s = signedIn('U-01');
    return reducer(s, { type: 'agent/applied', run: await heroRun(s), epoch: s.epoch });
  }

  it('lets the owner send the brief and logs it on the decision', async () => {
    const s = reducer(await withBrief(), { type: 'brief/notify', briefId: 'RB-01', actorId: 'U-02' });
    expect(s.briefs['RB-01']!.status).toBe('sent');
    const last = s.decisions['D-07']!.historyEntries.at(-1)!;
    expect(last).toMatchObject({ kind: 'stakeholders-notified', actorId: 'U-02', briefId: 'RB-01' });
    expect(last.cause).toBe('Reopen brief RB-01 sent to Joanne Lim, Priya Raman');
  });

  it('ignores a contributor trying to send or close it', async () => {
    const s = await withBrief();
    expect(reducer(s, { type: 'brief/notify', briefId: 'RB-01', actorId: 'U-03' })).toBe(s);
    expect(reducer(s, { type: 'brief/actioned', briefId: 'RB-01', actorId: 'U-03' })).toBe(s);
  });

  it('only sends once', async () => {
    const sent = reducer(await withBrief(), { type: 'brief/notify', briefId: 'RB-01', actorId: 'U-01' });
    expect(reducer(sent, { type: 'brief/notify', briefId: 'RB-01', actorId: 'U-01' })).toBe(sent);
  });
});
