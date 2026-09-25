// Root component: renders the current Screen from the navigation state machine. No router, so the single file build works from file://.
import type { ReactElement } from 'react';
import type { AppState, Screen, User } from './types';
import { AppShell } from './components/AppShell';
import { ErrorBoundary, ScreenFallback } from './components/ErrorBoundary';
import { useToast } from './components/Toast';
import { useShortcuts } from './lib/useShortcuts';
import { homeScreenFor, resolveScreen } from './state/navigation';
import { useStore } from './state/store';
import ContributorScreen from './screens/ContributorScreen';
import DecisionDetailScreen from './screens/DecisionDetailScreen';
import LoginScreen from './screens/LoginScreen';
import MfaScreen from './screens/MfaScreen';
import MyDecisionsScreen from './screens/MyDecisionsScreen';
import PortfolioScreen from './screens/PortfolioScreen';
import ReopenBriefScreen from './screens/ReopenBriefScreen';
import SettingsScreen from './screens/SettingsScreen';
import SignalInboxScreen from './screens/SignalInboxScreen';

type SignedInScreen = Exclude<Screen, { name: 'login' } | { name: 'mfa' }>;

function heading(screen: SignedInScreen, state: AppState, user: User): { title: string; subtitle?: string } {
  switch (screen.name) {
    case 'portfolio':
      return { title: 'Portfolio', subtitle: 'Every tracked decision across Calder Group' };
    case 'my-decisions':
      return { title: 'My decisions', subtitle: `Decisions owned by ${user.name}` };
    case 'contributor':
      return { title: 'Submit evidence', subtitle: 'Send a signal to the agent, and follow decisions you contribute to' };
    case 'inbox':
      return { title: 'Signal inbox', subtitle: 'Run the agent on a new piece of evidence' };
    case 'settings':
      return { title: 'Settings and admin' };
    case 'decision': {
      const d = state.decisions[screen.decisionId];
      return { title: d ? d.title : 'Decision', subtitle: screen.decisionId };
    }
    case 'brief':
      return { title: 'Reopen brief', subtitle: screen.briefId };
  }
}

function body(screen: SignedInScreen): ReactElement {
  switch (screen.name) {
    case 'portfolio':
      return <PortfolioScreen />;
    case 'my-decisions':
      return <MyDecisionsScreen />;
    case 'contributor':
      return <ContributorScreen />;
    case 'inbox':
      return <SignalInboxScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'decision':
      return <DecisionDetailScreen key={screen.decisionId} />;
    case 'brief':
      return <ReopenBriefScreen key={screen.briefId} />;
  }
}

export default function App() {
  const { state, dispatch, user } = useStore();
  const toast = useToast();
  useShortcuts(dispatch, user, toast);
  // Resolve on every render rather than trusting state.screen: a stale or tampered persisted
  // screen can never render something the current session is not allowed to see.
  const screen = resolveScreen(state, state.screen);

  if (!user || screen.name === 'login' || screen.name === 'mfa') {
    return screen.name === 'mfa' ? <MfaScreen /> : <LoginScreen key={state.session.loginHint ?? ''} />;
  }

  const { title, subtitle } = heading(screen, state, user);
  return (
    <AppShell user={user} screen={screen} title={title} subtitle={subtitle}>
      <ErrorBoundary
        key={`${screen.name}:${'decisionId' in screen ? screen.decisionId : 'briefId' in screen ? screen.briefId : ''}:${state.epoch}`}
        fallback={(retry) => (
          <ScreenFallback
            onHome={() => { dispatch({ type: 'navigate', screen: homeScreenFor(user.role) }); retry(); }}
            onReset={() => { dispatch({ type: 'reset' }); retry(); }}
          />
        )}
      >
        {body(screen)}
      </ErrorBoundary>
    </AppShell>
  );
}
