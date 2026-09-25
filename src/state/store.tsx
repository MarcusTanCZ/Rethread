// App state container: React context plus reducer, localStorage load/save with schema version, and Reset demo.
import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { AppState, User } from '../types';
import type { Action } from './actions';
import { createSeedState } from './initialState';
import { loadState, saveState } from './persistence';
import { reducer } from './reducer';
import { currentUser } from './selectors';

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  user: User | null;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Persisted state if it is readable and the same schema version, otherwise a fresh seed. */
function init(): AppState {
  const loaded = loadState();
  return loaded.status === 'loaded' ? loaded.state : createSeedState();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch, user: currentUser(state) }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
