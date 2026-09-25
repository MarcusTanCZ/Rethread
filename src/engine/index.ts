// Engine factory: picks Local or LLM from settings and wraps the LLM engine with fallback to Local plus a toast.
import type { ReasoningEngine, Settings } from '../types';
import { FallbackEngine } from './fallback';
import { LlmEngine, type FetchLike } from './llmEngine';
import { LocalEngine } from './localEngine';

export interface EngineHooks {
  /** Called when the LLM engine fails and the local engine takes over. */
  onFallback?: (reason: string) => void;
  fetchImpl?: FetchLike;
}

export function createEngine(settings: Settings, hooks: EngineHooks = {}): ReasoningEngine {
  const local = new LocalEngine({ shakyMargin: settings.thresholds.shakyMargin });
  if (settings.engine !== 'llm') return local;
  return new FallbackEngine(new LlmEngine(settings.llm, hooks.fetchImpl), local, hooks.onFallback);
}

export { FallbackEngine, LlmEngine, LocalEngine };
export { applyRun, runAgent } from './pipeline';
