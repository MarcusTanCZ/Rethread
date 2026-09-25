// Header user control: shows who is signed in and their role; the menu switches role (signing out to login) or signs out.
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LogOut, Repeat } from 'lucide-react';
import type { User } from '../types';
import { useStore } from '../state/store';
import { ROLE_LABEL } from './roleLabels';

function Avatar({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-800 font-semibold text-white ${
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-[11px]'
      }`}
      aria-hidden
    >
      {user.avatarInitials}
    </span>
  );
}

export function UserMenu({ user }: { user: User }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Arrow keys move between menu items.
  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  };

  const others = Object.values(state.users);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2.5 rounded px-2 hover:bg-slate-100"
      >
        <Avatar user={user} />
        <span className="text-left leading-tight">
          <span className="block text-[12.5px] font-medium text-slate-900">{user.name}</span>
          <span className="block text-[11px] text-slate-500">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      </button>

      {open && (
        <div role="menu" aria-label="Account" onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg shadow-slate-900/10">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <div className="text-[11px] text-slate-500">Signed in as</div>
            <div className="font-medium text-slate-900">{user.name} <span className="font-normal text-slate-500">({user.username})</span></div>
            <div className="text-[11.5px] text-slate-500">{user.title}</div>
          </div>

          <div className="px-3 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
            <Repeat className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />Switch role
          </div>
          <ul className="pb-1.5">
            {others.map((u) => {
              const current = u.id === user.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={current}
                    onClick={() => dispatch({ type: 'auth/logout', hint: u.username })}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <Avatar user={u} size="sm" />
                    <span className="flex-1 leading-tight">
                      <span className="block text-[12.5px] text-slate-900">{u.name}</span>
                      <span className="block text-[11px] text-slate-500">{ROLE_LABEL[u.role]}</span>
                    </span>
                    {current && <Check className="h-4 w-4 text-accent-600" aria-label="Current" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
            Switching signs you out and returns to login with that account filled in.
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => dispatch({ type: 'auth/logout' })}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
