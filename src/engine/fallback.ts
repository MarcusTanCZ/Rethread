// FallbackEngine: runs a primary engine and, on any error, reruns the signal on a fallback engine.
import type { Assumption, Evidence, Finding, ReasoningEngine, TraceSink, TraceStep } from '../types';

export class FallbackEngine implements ReasoningEngine {
  /** True when the last analyse() call fell back. Read by the pipeline to label the run. */
  lastFellBack = false;
  lastError: string | null = null;

  constructor(
    private readonly primary: ReasoningEngine,
    private readonly fallback: ReasoningEngine,
    /** Called with the failure reason, so the UI can show a toast. */
    private readonly onFallback?: (reason: string) => void,
  ) {}

  get kind() {
    return this.primary.kind;
  }

  async analyse(evidence: Evidence, assumptions: Assumption[], onTrace?: TraceSink): Promise<Finding[]> {
    this.lastFellBack = false;
    this.lastError = null;
    // Hold the primary's steps until it succeeds, so a failure part way through does not
    // leave half a trace ahead of the fallback's own.
    const held: TraceStep[] = [];
    try {
      const findings = await this.primary.analyse(evidence, assumptions, (s) => held.push(s));
      held.forEach((s) => onTrace?.(s));
      return findings;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.lastFellBack = true;
      this.lastError = reason;
      this.onFallback?.(reason);
      onTrace?.({
        kind: 'noop',
        title: 'Model unavailable, falling back to the local engine',
        lines: [reason],
        tone: 'warn',
      });
      return this.fallback.analyse(evidence, assumptions, onTrace);
    }
  }
}
