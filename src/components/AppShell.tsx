// Layout frame: left navigation filtered by role, header with the signed in user and role switcher, and the main content area sized for 1280 by 720.
import type { ReactNode } from 'react';
import { FilePlus2, Inbox, LayoutDashboard, ListChecks, Settings, type LucideIcon } from 'lucide-react';
import type { Screen, ScreenName, User } from '../types';
import { formatDate } from '../lib/format';
import { today } from '../lib/clock';
import { allowedScreens } from '../state/navigation';
import { visibleDecisions } from '../state/selectors';
import { useStore } from '../state/store';
import { BrandMark } from './BrandMark';
import { UserMenu } from './UserMenu';

interface NavItem {
  screen: Extract<ScreenName, 'portfolio' | 'my-decisions' | 'contributor' | 'inbox' | 'settings'>;
  label: string;
  icon: LucideIcon;
}

// Order is the order shown. Which items appear is decided by allowedScreens(role), the same
// table the navigation guard enforces, so the menu can never offer a screen the guard refuses.
const NAV: NavItem[] = [
  { screen: 'portfolio', label: 'Portfolio', icon: LayoutDashboard },
  { screen: 'my-decisions', label: 'My decisions', icon: ListChecks },
  { screen: 'contributor', label: 'Submit evidence', icon: FilePlus2 },
  { screen: 'inbox', label: 'Signal inbox', icon: Inbox },
  { screen: 'settings', label: 'Settings and admin', icon: Settings },
];

/** The nav item a screen belongs under. Decision and brief pages sit under the user's home. */
function activeItem(screen: Screen, user: User): ScreenName {
  if (screen.name === 'decision' || screen.name === 'brief') {
    return user.role === 'executive' ? 'portfolio' : user.role === 'owner' ? 'my-decisions' : 'contributor';
  }
  return screen.name;
}

export function AppShell({ user, screen, title, subtitle, children }: {
  user: User;
  screen: Screen;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { state, dispatch } = useStore();
  const allowed = allowedScreens(user.role);
  const items = NAV.filter((i) => allowed.includes(i.screen));
  const current = activeItem(screen, user);
  const awaitingReopen = visibleDecisions(state, user).filter((d) => d.status === 'reopen').length;
  const engineLabel = state.settings.engine === 'llm' ? 'LLM, local fallback' : 'Local, offline';

  return (
    <div className="flex h-screen min-w-0 print:block print:h-auto">
      <aside className="flex w-[208px] shrink-0 flex-col bg-slate-900 text-slate-400 print:hidden">
        <div className="flex h-12 items-center gap-2 border-b border-white/5 px-4">
          <BrandMark className="h-5 w-5 text-accent-500" />
          <div className="leading-tight">
            <div className="text-[13.5px] font-semibold tracking-tight text-white">Rethread</div>
            <div className="text-[10.5px] text-slate-500">Calder Group</div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3" aria-label="Main">
          <ul className="space-y-0.5">
            {items.map(({ screen: target, label, icon: Icon }) => {
              const active = current === target;
              const badge = (target === 'portfolio' || target === 'my-decisions') && awaitingReopen > 0 ? awaitingReopen : 0;
              return (
                <li key={target}>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'navigate', screen: { name: target } })}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex h-8 w-full items-center gap-2.5 rounded px-2.5 text-left text-[13px] transition-colors ${
                      active ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-accent-500" aria-hidden />}
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{label}</span>
                    {badge > 0 && (
                      <span className="rounded bg-broken-500 px-1.5 text-[10.5px] font-semibold leading-[18px] text-white" title={`${badge} awaiting reopen`}>
                        {badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <dl className="space-y-1 border-t border-white/5 px-4 py-3 text-[11px]">
          <div className="flex justify-between">
            <dt className="text-slate-500">Demo date</dt>
            <dd className="text-slate-300">{formatDate(today())}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Engine</dt>
            <dd className="text-slate-300">{engineLabel}</dd>
          </div>
        </dl>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col print:block">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-5 print:hidden">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="-mt-0.5 truncate text-[11.5px] text-slate-500">{subtitle}</p>}
          </div>
          <UserMenu user={user} />
        </header>
        <main className="min-h-0 flex-1 overflow-auto px-5 py-4 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  );
}
