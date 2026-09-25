import { describe, expect, it } from 'vitest';
import { buildSeed, DANIEL, JOANNE, PRIYA } from '../data/seed';
import type { DomainData, User } from '../types';
import {
  assumptionsFor,
  canSeeAdmin,
  canSeePortfolio,
  canUseInbox,
  currentUser,
  evidenceFor,
  visibleBriefs,
  visibleDecision,
  visibleDecisions,
} from './selectors';

const data = buildSeed();
const priya = data.users[PRIYA]!;
const joanne = data.users[JOANNE]!;
const daniel = data.users[DANIEL]!;
const ids = (u: User | null) => visibleDecisions(data, u).map((d) => d.id);

describe('visibleDecisions: executive', () => {
  it('sees every decision', () => {
    expect(ids(priya)).toEqual(Object.keys(data.decisions).sort());
    expect(ids(priya)).toHaveLength(12);
  });

  it('sees every value at risk, unchanged', () => {
    for (const d of visibleDecisions(data, priya)) expect(d.valueAtRisk).toBe(data.decisions[d.id]!.valueAtRisk);
  });

  it('has portfolio, admin and inbox access', () => {
    expect([canSeePortfolio(priya), canSeeAdmin(priya), canUseInbox(priya)]).toEqual([true, true, true]);
  });
});

describe('visibleDecisions: owner', () => {
  it('sees only decisions where owner === user.id', () => {
    const expected = Object.values(data.decisions).filter((d) => d.owner === JOANNE).map((d) => d.id).sort();
    expect(ids(joanne)).toEqual(expected);
    expect(ids(joanne)).toEqual(['D-03', 'D-04', 'D-06', 'D-07', 'D-10', 'D-11']);
  });

  it('does not see decisions where they are only a stakeholder', () => {
    const stakeholderOnly = Object.values(data.decisions).filter((d) => d.stakeholders.includes(JOANNE) && d.owner !== JOANNE);
    expect(stakeholderOnly.length).toBeGreaterThan(0);
    for (const d of stakeholderOnly) {
      expect(ids(joanne)).not.toContain(d.id);
      expect(visibleDecision(data, joanne, d.id)).toBeUndefined();
    }
  });

  it('sees values on their own decisions', () => {
    for (const d of visibleDecisions(data, joanne)) expect(d.valueAtRisk).toBe(data.decisions[d.id]!.valueAtRisk);
  });

  it('has inbox access but no portfolio or admin', () => {
    expect([canSeePortfolio(joanne), canSeeAdmin(joanne), canUseInbox(joanne)]).toEqual([false, false, true]);
  });
});

describe('visibleDecisions: contributor', () => {
  it('sees only decisions where they appear in stakeholders', () => {
    const expected = Object.values(data.decisions).filter((d) => d.stakeholders.includes(DANIEL)).map((d) => d.id).sort();
    expect(ids(daniel)).toEqual(expected);
    expect(ids(daniel)).toEqual(['D-04', 'D-06', 'D-09', 'D-10']);
  });

  it('cannot see the hero decision', () => {
    expect(ids(daniel)).not.toContain('D-07');
    expect(visibleDecision(data, daniel, 'D-07')).toBeUndefined();
    expect(assumptionsFor(data, daniel, 'D-07')).toEqual([]);
    expect(evidenceFor(data, daniel, 'D-07')).toEqual([]);
  });

  it('never receives valueAtRisk, not even in serialised output', () => {
    const seen = visibleDecisions(data, daniel);
    for (const d of seen) expect(d.valueAtRisk).toBeNull();
    const json = JSON.stringify(seen);
    for (const d of Object.values(data.decisions)) expect(json).not.toContain(String(d.valueAtRisk));
    expect(visibleDecision(data, daniel, 'D-04')!.valueAtRisk).toBeNull();
  });

  it('has no portfolio, admin, inbox or briefs', () => {
    expect([canSeePortfolio(daniel), canSeeAdmin(daniel), canUseInbox(daniel)]).toEqual([false, false, false]);
    const withBrief: DomainData = {
      ...data,
      briefs: { 'RB-01': { id: 'RB-01', decisionId: 'D-04' } as DomainData['briefs'][string] },
    };
    expect(visibleBriefs(withBrief, daniel)).toEqual([]);
  });
});

describe('visibleDecisions: fails closed', () => {
  it('returns nothing for no user', () => {
    expect(visibleDecisions(data, null)).toEqual([]);
    expect(visibleDecisions(data, undefined)).toEqual([]);
  });

  it('treats a signed in user with an unknown role as signed out', () => {
    const users = { ...data.users, 'U-01': { ...priya, role: 'intruder' } as unknown as User };
    const session = { stage: 'authenticated' as const, userId: 'U-01', pendingUserId: null, lockout: { failedAttempts: 0, lockedUntil: null }, error: null, loginHint: null };
    expect(currentUser({ users, session })).toBeNull();
    expect(currentUser({ users: data.users, session })?.id).toBe('U-01');
  });

  it('returns nothing for an unknown role', () => {
    const intruder = { ...priya, role: 'admin' } as unknown as User;
    expect(visibleDecisions(data, intruder)).toEqual([]);
  });

  it('returns copies, so mutating a result cannot change the store', () => {
    const d1 = visibleDecision(data, priya, 'D-01')!;
    d1.title = 'changed';
    d1.stakeholders.push(DANIEL);
    expect(data.decisions['D-01']!.title).not.toBe('changed');
    expect(data.decisions['D-01']!.stakeholders).not.toContain(DANIEL);
    expect(ids(daniel)).not.toContain('D-01');
  });

  it('follows the data when ownership changes, not any cached view', () => {
    const moved = buildSeed();
    moved.decisions['D-01']!.owner = JOANNE;
    moved.decisions['D-07']!.stakeholders.push(DANIEL);
    expect(visibleDecisions(moved, joanne).map((d) => d.id)).toContain('D-01');
    expect(visibleDecisions(moved, daniel).map((d) => d.id)).toContain('D-07');
    expect(visibleDecision(moved, daniel, 'D-07')!.valueAtRisk).toBeNull();
  });
});

describe('scoped records', () => {
  it('limits evidence findings to the decision being viewed', () => {
    for (const d of visibleDecisions(data, priya)) {
      const own = new Set(d.assumptionIds);
      for (const e of evidenceFor(data, priya, d.id)) for (const f of e.findings) expect(own.has(f.assumptionId)).toBe(true);
    }
  });

  it('returns evidence newest first', () => {
    const dates = evidenceFor(data, priya, 'D-02').map((e) => e.receivedOn);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
