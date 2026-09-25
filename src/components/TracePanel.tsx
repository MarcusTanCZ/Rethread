// Stepped agent trace: each step appears as "working", then resolves with its findings, one step per interval, with Skip animation and Replay.
import { useEffect, useRef } from 'react';
import {
  Bot, FastForward, FileSearch, FileText, FlaskConical, GitBranch, Gavel, ListTree, RotateCcw, ScanSearch, ShieldCheck, Undo2,
  type LucideIcon,
} from 'lucide-react';
import type { TraceStep, TraceStepKind, TraceTone } from '../types';

const ICON: Record<TraceStepKind, LucideIcon> = {
  read: FileText,
  extract: ScanSearch,
  match: ListTree,
  test: FlaskConical,
  verdict: Gavel,
  status: GitBranch,
  revive: Undo2,
  draft: FileSearch,
  noop: ShieldCheck,
};

/** The present participle shown while a step is being worked on. */
const WORKING: Record<TraceStepKind, string> = {
  read: 'Reading the signal',
  extract: 'Extracting claims',
  match: 'Matching against tracked assumptions',
  test: 'Testing an assumption',
  verdict: 'Weighing the verdict',
  status: 'Updating decision status',
  revive: 'Rechecking rejected options',
  draft: 'Drafting the reopen brief',
  noop: 'Concluding',
};

// Status colours only where the step reports a status outcome.
const NODE: Record<TraceTone, string> = {
  info: 'bg-white text-slate-500 ring-slate-300',
  ok: 'bg-holding-50 text-holding-700 ring-holding-500/50',
  warn: 'bg-shaky-50 text-shaky-700 ring-shaky-500/60',
  alert: 'bg-broken-50 text-broken-700 ring-broken-500/60',
};
const TITLE: Record<TraceTone, string> = {
  info: 'text-slate-900',
  ok: 'text-slate-900',
  warn: 'text-shaky-700',
  alert: 'text-broken-700',
};

/** Placeholder list shown before any run, so the audience sees what the agent will do. */
const PREVIEW = ['Read the signal', 'Extract claims', 'Match against tracked assumptions', 'Test each assumption in scope',
  'Reach a verdict', 'Update decision status', 'Recheck rejected options', 'Draft the reopen brief'];

export interface TracePanelProps {
  steps: TraceStep[] | null;
  /** Steps fully revealed so far. The next one, if any, is shown as working. */
  revealed: number;
  animating: boolean;
  stepMs: number;
  engineLabel: string;
  onSkip: () => void;
  onReplay?: () => void;
}

function StepLines({ step }: { step: TraceStep }) {
  if (!step.lines.length) return null;
  if (step.kind === 'test') {
    return (
      <div className="mt-1.5 space-y-0.5 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11.5px] leading-[1.55] text-slate-700">
        {step.lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    );
  }
  return (
    <ul className="mt-1 space-y-0.5 text-[12px] leading-[1.5] text-slate-600">
      {step.lines.map((l, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden />
          <span className="min-w-0">{l}</span>
        </li>
      ))}
    </ul>
  );
}

export function TracePanel({ steps, revealed, animating, stepMs, engineLabel, onSkip, onReplay }: TracePanelProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const total = steps?.length ?? 0;
  const done = !!steps && !animating && revealed >= total;

  // Keep the newest step in view as the trace grows.
  useEffect(() => {
    const el = listRef.current?.lastElementChild as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', behavior: animating ? 'smooth' : 'auto' });
  }, [revealed, animating]);

  return (
    <section className="card flex min-h-0 flex-1 flex-col" aria-label="Agent trace">
      <header className="card-header">
        <Bot className="h-4 w-4 text-slate-500" aria-hidden />
        <h2 className="card-title">Agent trace</h2>
        <span className="text-[11px] text-slate-400">{engineLabel}</span>
        <div className="ml-auto flex items-center gap-3">
          {steps && animating && (
            <span className="flex items-center gap-1.5 text-[11.5px] text-slate-600" aria-live="polite">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-accent-500" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-500" />
              </span>
              Working, step {Math.min(revealed + 1, total)} of {total}
            </span>
          )}
          {done && <span className="text-[11.5px] text-slate-500">Finished, {total} steps</span>}
          {steps && animating && (
            <button type="button" onClick={onSkip} className="btn-quiet h-7 px-2 text-[12px]">
              <FastForward className="h-3.5 w-3.5" aria-hidden /> Skip animation
            </button>
          )}
          {done && onReplay && (
            <button type="button" onClick={onReplay} className="btn-quiet h-7 px-2 text-[12px]">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Replay
            </button>
          )}
        </div>
      </header>
      <div className="h-0.5 bg-slate-100" aria-hidden>
        <div className="h-full bg-accent-500 transition-[width] ease-linear" style={{ width: `${total ? (Math.min(revealed, total) / total) * 100 : 0}%`, transitionDuration: `${stepMs}ms` }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {!steps ? (
          <div>
            <p className="mb-3 text-slate-500">Load a sample or paste a signal, then run the agent. Each step of its reasoning appears here as it works.</p>
            <ol className="space-y-2.5">
              {PREVIEW.map((p, i) => (
                <li key={p} className="flex items-center gap-3 text-slate-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-[11px]">{i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          </div>
        ) : total === 0 ? (
          <div className="flex items-center gap-3 text-slate-600">
            <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-accent-50 text-accent-600 ring-1 ring-accent-500/60">
              <span className="absolute inset-0 animate-ping2 rounded-full ring-1 ring-accent-500" aria-hidden />
              <Bot className="h-3.5 w-3.5" aria-hidden />
            </span>
            Contacting the reasoning engine
            <span className="-ml-2 inline-flex gap-0.5" aria-hidden>
              <span className="animate-blink">.</span><span className="animate-blink [animation-delay:150ms]">.</span><span className="animate-blink [animation-delay:300ms]">.</span>
            </span>
          </div>
        ) : (
          <ol ref={listRef} className="relative">
            {steps.slice(0, Math.min(total, revealed + (animating ? 1 : 0))).map((step, i) => {
              const working = animating && i === revealed;
              const Icon = ICON[step.kind];
              const last = i === Math.min(total, revealed + (animating ? 1 : 0)) - 1;
              return (
                <li key={i} className="relative flex animate-rise gap-3 pb-3.5">
                  {!last && <span className="absolute left-3 top-7 h-[calc(100%-1.75rem)] w-px bg-slate-200" aria-hidden />}
                  <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ${
                    working ? 'bg-accent-50 text-accent-600 ring-accent-500/60' : NODE[step.tone]}`}>
                    {working && <span className="absolute inset-0 animate-ping2 rounded-full ring-1 ring-accent-500" aria-hidden />}
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="w-4 shrink-0 text-[10.5px] font-semibold text-slate-400">{i + 1}</span>
                      {working ? (
                        <span className="font-medium text-slate-700">
                          {WORKING[step.kind]}
                          <span className="ml-0.5 inline-flex gap-0.5" aria-hidden>
                            <span className="animate-blink">.</span>
                            <span className="animate-blink [animation-delay:150ms]">.</span>
                            <span className="animate-blink [animation-delay:300ms]">.</span>
                          </span>
                        </span>
                      ) : (
                        <span className={`min-w-0 font-medium ${TITLE[step.tone]}`}>{step.title}</span>
                      )}
                      <span className="ml-auto shrink-0 pl-2 text-[10.5px] tabular-nums text-slate-400">
                        +{((i * stepMs) / 1000).toFixed(1)}s
                      </span>
                    </div>
                    {working ? (
                      <div className="ml-6 mt-1.5 space-y-1.5" aria-hidden>
                        <div className="h-2 w-3/4 animate-pulse rounded bg-slate-100" />
                        <div className="h-2 w-1/2 animate-pulse rounded bg-slate-100" />
                      </div>
                    ) : (
                      <div className="ml-6"><StepLines step={step} /></div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
