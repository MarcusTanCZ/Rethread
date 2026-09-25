// Toast provider and viewport for transient notices such as LLM fallback and Notify stakeholders.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { Toast, ToastTone } from '../types';

type Push = (tone: ToastTone, message: string) => void;
const ToastContext = createContext<Push>(() => {});

const ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };
const ICON_COLOUR = { info: 'text-slate-300', success: 'text-holding-500', warning: 'text-shaky-500', error: 'text-broken-500' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback<Push>((tone, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    window.setTimeout(() => dismiss(id), tone === 'warning' || tone === 'error' ? 7000 : 4000);
  }, [dismiss]);

  // Errors outside React rendering (timers, promises) must not pass silently or break the
  // page. Say so calmly, at most once every few seconds.
  const lastBackgroundError = useRef(0);
  useEffect(() => {
    const onError = (e: ErrorEvent | PromiseRejectionEvent) => {
      console.error('Rethread background error', 'reason' in e ? e.reason : e.error);
      if (Date.now() - lastBackgroundError.current < 5000) return;
      lastBackgroundError.current = Date.now();
      push('warning', 'Something went wrong in the background. The demo can continue; press R as ceo to reset if anything looks off.');
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onError);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onError);
    };
  }, [push]);

  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[360px] flex-col gap-2 print:hidden" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex animate-rise items-start gap-2.5 rounded-md bg-slate-900 px-3.5 py-2.5 text-[12.5px] text-slate-100 shadow-lg shadow-slate-900/20">
              <Icon className={`mt-px h-4 w-4 shrink-0 ${ICON_COLOUR[t.tone]}`} aria-hidden />
              <span className="flex-1">{t.message}</span>
              <button type="button" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-white" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Push {
  return useContext(ToastContext);
}
