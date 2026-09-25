// Action type union for the reducer. Grows as screens are built (evidence, analysis, briefs).
import type { AgentRunResult, BriefId, Screen, Settings, UserId } from '../types';

export type SettingsPatch = Partial<Omit<Settings, 'llm' | 'thresholds'>> & {
  llm?: Partial<Settings['llm']>;
  thresholds?: Partial<Settings['thresholds']>;
};

export type Action =
  /** Restore the seed exactly. Keeps who is signed in and the LLM key; everything else resets. */
  | { type: 'reset' }
  | { type: 'navigate'; screen: Screen }
  | { type: 'settings/update'; patch: SettingsPatch }
  /** Step 1. `at` is the wall clock in ms, passed in so the reducer stays pure. */
  | { type: 'auth/password'; username: string; password: string; at: number }
  /** Step 2. */
  | { type: 'auth/code'; code: string; at: number }
  /** From the MFA step back to credentials. */
  | { type: 'auth/back' }
  /** Sign out. `hint` prefills the username, used by the role switcher. */
  | { type: 'auth/logout'; hint?: string }
  /** Commit an agent run once its trace has been shown (or skipped). */
  | { type: 'agent/applied'; run: AgentRunResult; epoch: number }
  /** Mock send of a reopen brief to its notify list. */
  | { type: 'brief/notify'; briefId: BriefId; actorId: UserId }
  /** The owner records that the brief has been acted on. */
  | { type: 'brief/actioned'; briefId: BriefId; actorId: UserId }
  /** Reset to the seed, open the signal inbox and load the FrostLink notice ready to run. */
  | { type: 'demo/loadHero' }
  /** The inbox has loaded its preload sample. */
  | { type: 'inbox/preloadConsumed' };
