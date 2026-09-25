// Presenter keyboard shortcuts: R resets the demo, D resets and loads the hero signal into the inbox. Ignored while typing.
import { useEffect, useRef } from 'react';
import type { User } from '../types';
import type { Action } from '../state/actions';

type Push = (tone: 'info' | 'success' | 'warning' | 'error', message: string) => void;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Demo controls, available on the login screen and to the executive account. They are a
 * convenience for the presenter, not a security boundary: the data lives in this browser's
 * localStorage, which anyone at the keyboard can clear.
 */
export function canUseDemoControls(user: User | null): boolean {
  return !user || user.role === 'executive';
}

export function useShortcuts(dispatch: (a: Action) => void, user: User | null, toast: Push) {
  // Read through a ref so the listener is attached once and never goes stale.
  const ctx = useRef({ dispatch, user, toast });
  ctx.current = { dispatch, user, toast };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      try {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
        const key = e.key.toLowerCase();
        if (key !== 'r' && key !== 'd') return;
        const { dispatch: send, user: u, toast: say } = ctx.current;
        if (!canUseDemoControls(u)) {
          say('info', 'Demo shortcuts are available to the executive account (ceo).');
          return;
        }
        e.preventDefault();
        if (key === 'r') {
          send({ type: 'reset' });
          say('success', 'Demo reset to the seeded scenario.');
        } else if (!u) {
          say('info', 'Sign in as ceo, then press D to load the hero scenario.');
        } else {
          send({ type: 'demo/loadHero' });
          say('success', 'Hero scenario loaded. Press Enter to run the agent.');
        }
      } catch (err) {
        console.error(err);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
