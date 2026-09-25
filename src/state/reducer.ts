// Pure reducer over AppState. Kept free of React and storage so it can be unit tested.
import type { AppState, AuthErrorKind, BriefId, DomainData, HistoryEntry, Lockout, Session, UserId } from '../types';
import { applyRun } from '../engine/pipeline';
import { nowISO } from '../lib/clock';
import { nextId } from '../lib/ids';
import { acceptedCodes, expireLockout, findUserByCredentials, isLocked, MAX_ATTEMPTS, noLockout, registerFailure } from '../lib/auth';
import type { Action } from './actions';
import { createSeedState, signedOutSession } from './initialState';
import { homeScreenFor, resolveScreen } from './navigation';
import { visibleBriefs } from './selectors';

/** Session fields after a failed attempt: counts it, and locks on the third. */
function fail(lockout: Lockout, at: number, kind: AuthErrorKind): Pick<Session, 'lockout' | 'error'> {
  const next = registerFailure(lockout, at);
  return isLocked(next, at)
    ? { lockout: next, error: { kind: 'locked', attemptsLeft: 0 } }
    : { lockout: next, error: { kind, attemptsLeft: MAX_ATTEMPTS - next.failedAttempts } };
}

function domainOf(s: AppState): DomainData {
  const { users, decisions, assumptions, rejectedOptions, evidence, briefs } = s;
  return { users, decisions, assumptions, rejectedOptions, evidence, briefs };
}

/** Updates a brief's status and logs it on the decision. No-op if the brief is missing. */
function updateBrief(state: AppState, briefId: BriefId, actorId: UserId, to: 'sent' | 'actioned'): AppState {
  const brief = state.briefs[briefId];
  const decision = brief && state.decisions[brief.decisionId];
  // Only someone who can see the brief may send or close it: executives, and the owner.
  if (!visibleBriefs(state, state.users[actorId]).some((b) => b.id === briefId)) return state;
  if (!brief || !decision || (to === 'sent' && brief.status !== 'draft') || (to === 'actioned' && brief.status === 'actioned')) return state;
  const at = nowISO();
  const names = brief.notifyList.map((id) => state.users[id]?.name ?? id).join(', ');
  const entry: HistoryEntry = {
    id: nextId('H', Object.values(state.decisions).flatMap((d) => d.historyEntries.map((h) => h.id)), 3),
    at,
    kind: to === 'sent' ? 'stakeholders-notified' : 'brief-actioned',
    cause: to === 'sent' ? `Reopen brief ${briefId} sent to ${names}` : `Reopen brief ${briefId} marked as actioned`,
    actorId,
    briefId,
  };
  return {
    ...state,
    briefs: { ...state.briefs, [briefId]: { ...brief, status: to, ...(to === 'sent' ? { sentOn: at } : {}) } },
    decisions: { ...state.decisions, [decision.id]: { ...decision, historyEntries: [...decision.historyEntries, entry] } },
  };
}

export const HERO_SAMPLE = 'frostlink-rate-notice';

/**
 * The seed exactly, with the session, the LLM key and a bumped epoch carried over. Pure and
 * cheap (a fresh seed is built from constants), so it is instant and resetting twice gives
 * the same data as resetting once.
 */
function resetState(state: AppState): AppState {
  const seed = createSeedState();
  const next: AppState = {
    ...seed,
    session: state.session,
    settings: { ...seed.settings, llm: { ...seed.settings.llm, apiKey: state.settings.llm.apiKey } },
    epoch: state.epoch + 1,
  };
  // The screen may point at a brief or decision state that no longer exists; send home.
  return { ...next, screen: resolveScreen(next, { name: 'portfolio' }) };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'reset':
      return resetState(state);

    case 'navigate':
      return { ...state, screen: resolveScreen(state, action.screen) };

    case 'auth/password': {
      const lockout = expireLockout(state.session.lockout, action.at);
      if (isLocked(lockout, action.at)) {
        return { ...state, session: { ...state.session, lockout, error: { kind: 'locked', attemptsLeft: 0 } } };
      }
      const user = findUserByCredentials(state.users, action.username, action.password);
      if (!user) return { ...state, session: { ...state.session, ...fail(lockout, action.at, 'bad-credentials') } };
      return {
        ...state,
        session: { ...state.session, stage: 'mfa', pendingUserId: user.id, lockout, error: null },
        screen: { name: 'mfa' },
      };
    }

    case 'auth/code': {
      const { session } = state;
      if (session.stage !== 'mfa' || !session.pendingUserId) return state;
      const lockout = expireLockout(session.lockout, action.at);
      if (isLocked(lockout, action.at)) {
        return { ...state, session: { ...session, lockout, error: { kind: 'locked', attemptsLeft: 0 } } };
      }
      if (!acceptedCodes(action.at).includes(action.code.trim())) {
        return { ...state, session: { ...session, ...fail(lockout, action.at, 'bad-code') } };
      }
      const user = state.users[session.pendingUserId]!;
      const next: AppState = {
        ...state,
        session: { stage: 'authenticated', pendingUserId: null, userId: user.id, lockout: noLockout(), error: null, loginHint: null },
      };
      return { ...next, screen: homeScreenFor(user.role) };
    }

    case 'auth/back':
      return {
        ...state,
        session: { ...state.session, stage: 'password', pendingUserId: null, error: null },
        screen: { name: 'login' },
      };

    case 'auth/logout':
      return { ...state, session: signedOutSession(action.hint ?? null), screen: { name: 'login' }, lastRun: null };

    case 'agent/applied':
      // A run started before a reset belongs to data that no longer exists.
      if (action.epoch !== state.epoch) return state;
      return { ...state, ...applyRun(domainOf(state), action.run), lastRun: action.run };

    case 'demo/loadHero': {
      const fresh = resetState(state);
      const screen = resolveScreen(fresh, { name: 'inbox' });
      return { ...fresh, screen, inboxPreload: screen.name === 'inbox' ? HERO_SAMPLE : null };
    }

    case 'inbox/preloadConsumed':
      return state.inboxPreload === null ? state : { ...state, inboxPreload: null };

    case 'brief/notify':
      return updateBrief(state, action.briefId, action.actorId, 'sent');

    case 'brief/actioned':
      return updateBrief(state, action.briefId, action.actorId, 'actioned');

    case 'settings/update': {
      const { llm, thresholds, ...rest } = action.patch;
      return {
        ...state,
        settings: {
          ...state.settings,
          ...rest,
          llm: { ...state.settings.llm, ...llm },
          thresholds: { ...state.settings.thresholds, ...thresholds },
        },
      };
    }
  }
}
