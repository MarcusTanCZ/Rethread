// Runs the agent on a draft signal and paces the trace reveal. The run is committed to the store when the reveal ends, is skipped, or the screen unmounts.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentRunResult, EvidenceDraft } from '../types';
import { createEngine } from '../engine';
import { runAgent } from '../engine/pipeline';
import { useStore } from '../state/store';
import { useToast } from '../components/Toast';

export type RunPhase = 'idle' | 'thinking' | 'revealing' | 'done';

export function useAgentRun({ animate }: { animate: boolean }) {
  const { state, dispatch, user } = useStore();
  const toast = useToast();
  const stateRef = useRef(state);
  stateRef.current = state;

  // Start from the last committed run, fully revealed, so returning to the screen shows it.
  const [run, setRun] = useState<AgentRunResult | null>(animate ? state.lastRun : null);
  const [revealed, setRevealed] = useState(run ? run.trace.length : 0);
  const [phase, setPhase] = useState<RunPhase>(run ? 'done' : 'idle');
  // The run waiting to be committed, tagged with the epoch it was computed against. The
  // reducer drops it if a reset has happened since.
  const pending = useRef<{ run: AgentRunResult; epoch: number } | null>(null);

  const commit = useCallback(() => {
    if (!pending.current) return;
    dispatch({ type: 'agent/applied', run: pending.current.run, epoch: pending.current.epoch });
    pending.current = null;
  }, [dispatch]);

  // A reset clears whatever this screen was showing.
  const epoch = state.epoch;
  const seenEpoch = useRef(epoch);
  useEffect(() => {
    if (seenEpoch.current === epoch) return;
    seenEpoch.current = epoch;
    pending.current = null;
    setRun(null);
    setRevealed(0);
    setPhase('idle');
  }, [epoch]);

  const start = useCallback(async (draft: EvidenceDraft) => {
    if (!user) return;
    commit();
    setPhase('thinking');
    setRun(null);
    setRevealed(0);
    const s = stateRef.current;
    try {
      const engine = createEngine(s.settings, {
        onFallback: (reason) => toast('warning', `LLM engine unavailable (${reason}). Fell back to the local engine.`),
      });
      const result = await runAgent({ data: s, draft, submittedBy: user.id, engine, thresholds: s.settings.thresholds });
      if (stateRef.current.epoch !== s.epoch) return; // reset while the engine was working
      pending.current = { run: result, epoch: s.epoch };
      setRun(result);
      if (animate) {
        setPhase('revealing');
      } else {
        setRevealed(result.trace.length);
        setPhase('done');
        commit();
      }
    } catch (e) {
      // Never leave the presenter with a stuck "running" state.
      console.error(e);
      setPhase('idle');
      toast('error', 'The agent could not analyse that signal. Nothing was changed; try again or load a sample.');
    }
  }, [animate, commit, toast, user]);

  // One step per interval while revealing; commit when the last one lands.
  useEffect(() => {
    if (phase !== 'revealing' || !run) return;
    if (revealed >= run.trace.length) {
      setPhase('done');
      commit();
      return;
    }
    const id = window.setTimeout(() => setRevealed((r) => r + 1), stateRef.current.settings.traceStepMs);
    return () => window.clearTimeout(id);
  }, [phase, revealed, run, commit]);

  const skip = useCallback(() => {
    if (!run) return;
    setRevealed(run.trace.length);
    setPhase('done');
    commit();
  }, [run, commit]);

  const replay = useCallback(() => {
    if (!run) return;
    setRevealed(0);
    setPhase('revealing');
  }, [run]);

  // Leaving mid reveal still records the run.
  useEffect(() => () => commit(), [commit]);

  return { run, revealed, phase, start, skip, replay, stepMs: state.settings.traceStepMs };
}
