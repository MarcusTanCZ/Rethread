// Error boundaries: a calm recovery card instead of a white screen. One wraps the whole app, one wraps each screen so navigation keeps working.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { LifeBuoy, RotateCcw } from 'lucide-react';
import { clearState } from '../state/persistence';

interface Props {
  children: ReactNode;
  /** Renders the recovery UI. `retry` clears the error and renders the children again. */
  fallback: (retry: () => void) => ReactNode;
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Rethread caught a render error', error, info.componentStack);
  }

  retry = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}

/** Last resort around everything, including the store. Reloading, or clearing saved data, always recovers. */
export function AppFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <div className="card w-full max-w-md px-6 py-5">
        <div className="flex items-center gap-2.5">
          <LifeBuoy className="h-5 w-5 text-slate-500" aria-hidden />
          <h1 className="text-[15px] font-semibold text-slate-900">Rethread needs a moment</h1>
        </div>
        <p className="mt-2 text-slate-600">
          Something unexpected stopped this page from drawing. Nothing has been sent anywhere, and your demo data is still saved in this browser.
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>Reload</button>
          <button type="button" className="btn-quiet" onClick={() => { clearState(); window.location.reload(); }}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset demo and reload
          </button>
        </div>
      </div>
    </div>
  );
}

/** Inside the shell: the navigation stays usable, so the presenter can simply move on. */
export function ScreenFallback({ onHome, onReset }: { onHome: () => void; onReset: () => void }) {
  return (
    <div className="card mx-auto mt-6 max-w-lg px-6 py-5">
      <div className="flex items-center gap-2.5">
        <LifeBuoy className="h-5 w-5 text-slate-500" aria-hidden />
        <h2 className="text-[15px] font-semibold text-slate-900">This screen could not be shown</h2>
      </div>
      <p className="mt-2 text-slate-600">The rest of Rethread is working. Go back to your home screen, or reset the demo to the seeded scenario.</p>
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-primary" onClick={onHome}>Back to home</button>
        <button type="button" className="btn-quiet" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset demo
        </button>
      </div>
    </div>
  );
}
