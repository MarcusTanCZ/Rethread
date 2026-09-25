// Screen state machine: allowed screens per role, default landing screen, and guarded transitions (no router).
import type { AppState, Role, Screen, ScreenName } from '../types';
import { canSeeDecision, currentUser, visibleBriefs } from './selectors';

const SCREENS_BY_ROLE: Record<Role, readonly ScreenName[]> = {
  executive: ['portfolio', 'decision', 'inbox', 'brief', 'settings'],
  owner: ['my-decisions', 'decision', 'inbox', 'brief'],
  contributor: ['contributor', 'decision'],
};

export function allowedScreens(role: Role): readonly ScreenName[] {
  return SCREENS_BY_ROLE[role] ?? [];
}

export function homeScreenFor(role: Role): Screen {
  switch (role) {
    case 'executive':
      return { name: 'portfolio' };
    case 'owner':
      return { name: 'my-decisions' };
    case 'contributor':
      return { name: 'contributor' };
  }
}

/**
 * Resolves a requested screen to one the current session may actually show. Signed out
 * sessions are held on login or MFA; signed in users are sent home from any screen their role,
 * or the record it points at, does not allow.
 */
export function resolveScreen(state: AppState, requested: Screen): Screen {
  const user = currentUser(state);
  if (!user) return state.session.stage === 'mfa' ? { name: 'mfa' } : { name: 'login' };

  const home = homeScreenFor(user.role);
  if (!SCREENS_BY_ROLE[user.role].includes(requested.name)) return home;

  if (requested.name === 'decision' && !canSeeDecision(state, user, requested.decisionId)) return home;
  if (requested.name === 'brief' && !visibleBriefs(state, user).some((b) => b.id === requested.briefId)) return home;
  return requested;
}
