// Signal inbox: paste area, six sample signals, Run agent, trace panel and result summary.
import { EvidenceComposer } from '../components/EvidenceComposer';
import { RunSummary } from '../components/RunSummary';
import { TracePanel } from '../components/TracePanel';
import { useAgentRun } from '../lib/useAgentRun';
import { useStore } from '../state/store';

export default function SignalInboxScreen() {
  const { state, dispatch } = useStore();
  const { run, revealed, phase, start, skip, replay, stepMs } = useAgentRun({ animate: true });
  const busy = phase === 'thinking' || phase === 'revealing';
  const engineLabel = run?.fellBack
    ? 'Local engine (LLM fell back)'
    : (run?.engineUsed ?? state.settings.engine) === 'llm' ? 'LLM engine' : 'Local engine, deterministic';

  return (
    <div className="grid h-full min-h-[560px] grid-cols-[minmax(340px,380px)_minmax(0,1fr)] gap-4">
      <EvidenceComposer onRun={start} busy={busy} preloadKey={state.inboxPreload}
        onPreloaded={() => dispatch({ type: 'inbox/preloadConsumed' })} />
      <div className="flex min-h-0 flex-col gap-3">
        <div className={`flex min-h-0 flex-col ${phase === 'done' ? 'flex-[1_1_0]' : 'flex-1'}`}>
          <TracePanel
            steps={run ? run.trace : phase === 'thinking' ? [] : null}
            revealed={revealed}
            animating={busy}
            stepMs={stepMs}
            engineLabel={engineLabel}
            onSkip={skip}
            onReplay={replay}
          />
        </div>
        {phase === 'done' && run && (
          <div className="max-h-[45%] shrink-0 overflow-y-auto">
            <RunSummary run={run} />
          </div>
        )}
      </div>
    </div>
  );
}
