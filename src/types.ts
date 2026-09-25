// Domain, engine, trace, session, navigation and store types for Rethread. See SPEC.md, "Data model".

/* ------------------------------------------------------------------ primitives */

/** ISO 8601 date (YYYY-MM-DD) or datetime (YYYY-MM-DDTHH:mm:ssZ). */
export type ISODate = string;

export type UserId = string; // e.g. "U-01"
export type DecisionId = string; // e.g. "D-07"
export type AssumptionId = string; // e.g. "A-104"
export type RejectedOptionId = string; // e.g. "RO-11"
export type EvidenceId = string; // e.g. "E-01"
export type BriefId = string; // e.g. "RB-01"
export type HistoryEntryId = string; // e.g. "H-001"

/* ------------------------------------------------------------------ users */

export type Role = 'executive' | 'owner' | 'contributor';

export interface User {
  id: UserId;
  name: string;
  role: Role;
  username: string;
  /** Demo only. Plain text by design: these are published seed credentials, not secrets. */
  password: string;
  avatarInitials: string;
  /** Display only, e.g. "Logistics" or "Operations coordinator". */
  title?: string;
}

/* ------------------------------------------------------------------ decisions */

export type DecisionStatus = 'active' | 'watch' | 'reopen' | 'superseded' | 'closed';

export type HistoryEntryKind =
  | 'created'
  | 'status-change'
  | 'assumption-change'
  | 'evidence-linked'
  | 'brief-drafted'
  | 'stakeholders-notified'
  | 'brief-actioned';

export interface HistoryEntry {
  id: HistoryEntryId;
  at: ISODate;
  kind: HistoryEntryKind;
  /** Plain English cause, e.g. "A-104 broken by E-10 (FrostLink rate notice)". */
  cause: string;
  /** Null when the change came from the agent rather than a person. */
  actorId: UserId | null;
  fromStatus?: DecisionStatus;
  toStatus?: DecisionStatus;
  assumptionId?: AssumptionId;
  fromAssumptionStatus?: AssumptionStatus;
  toAssumptionStatus?: AssumptionStatus;
  evidenceId?: EvidenceId;
  briefId?: BriefId;
}

export interface Decision {
  id: DecisionId;
  title: string;
  summary: string;
  decidedOn: ISODate;
  owner: UserId;
  stakeholders: UserId[];
  status: DecisionStatus;
  /** SGD. Redacted by selectors for roles that may not see it. */
  valueAtRisk: number;
  category: string;
  reviewDate: ISODate;
  assumptionIds: AssumptionId[];
  rejectedOptionIds: RejectedOptionId[];
  evidenceIds: EvidenceId[];
  historyEntries: HistoryEntry[];
}

/**
 * What a screen receives from visibleDecisions(user). valueAtRisk is null when the
 * viewer's role may not see it, so redaction is enforced by data, not by hiding UI.
 */
export type VisibleDecision = Omit<Decision, 'valueAtRisk'> & { valueAtRisk: number | null };

/* ------------------------------------------------------------------ assumptions */

export type ThresholdOperator = '<=' | '>=' | '==';

export interface ThresholdTest {
  kind: 'threshold';
  /** Stable metric key, e.g. "frostlink.unit_rate". */
  metric: string;
  operator: ThresholdOperator;
  /** The threshold the assumption must satisfy, e.g. 42.00. */
  value: number;
  /** Display unit, e.g. "SGD per pallet". */
  unit: string;
  /**
   * Current known value, used as the base when a signal states a percentage change
   * ("increase by 19 percent" applied to 42.00). Addition to SPEC, see build plan.
   */
  baseline: number;
  /** Phrases that tie a number in the text to this metric, e.g. ["per pallet", "handling rate"]. */
  metricAliases: string[];
  /** Entity names that must appear for the test to apply at all, e.g. ["FrostLink"]. */
  scope: string[];
  /** For '==' only: allowed absolute tolerance. */
  tolerance?: number;
}

export interface ConditionTest {
  kind: 'condition';
  /** Terms that make a signal relevant to this assumption, e.g. ["FrostLink", "halal"]. */
  keywords: string[];
  /** Terms that contradict the assumption when present with the keywords, e.g. ["revoked"]. */
  negativeKeywords: string[];
}

export type AssumptionTest = ThresholdTest | ConditionTest;

export type Criticality = 'critical' | 'supporting';
export type AssumptionStatus = 'holding' | 'shaky' | 'broken';

export interface Assumption {
  id: AssumptionId;
  decisionId: DecisionId;
  statement: string;
  test: AssumptionTest;
  criticality: Criticality;
  status: AssumptionStatus;
  /** Confidence (0 to 1) in the current status. */
  confidence: number;
  lastTestedOn: ISODate;
  evidenceIds: EvidenceId[];
  /** Latest value observed for threshold tests, set when evidence yields one. */
  currentValue?: number;
}

/* ------------------------------------------------------------------ rejected options */

export interface RejectedOption {
  id: RejectedOptionId;
  decisionId: DecisionId;
  title: string;
  description: string;
  rejectedBecause: string;
  /** Null when the rejection was not tied to a tracked assumption (e.g. RO-12, capital cost). */
  rejectedBecauseAssumptionId: AssumptionId | null;
  /** In the same unit as the killing assumption's threshold metric. */
  comparableValue: number | null;
  /** Computed at reopen time. False in seed. */
  revivable: boolean;
}

/* ------------------------------------------------------------------ evidence */

export type EvidenceSource = 'email' | 'meeting-note' | 'metric' | 'regulatory' | 'news' | 'manual';
export type Verdict = 'supports' | 'contradicts' | 'neutral';

export interface Finding {
  assumptionId: AssumptionId;
  verdict: Verdict;
  confidence: number;
  /** One plain English sentence naming what was found and what it was compared to. */
  rationale: string;
  /** For threshold tests: the value the evidence implies, e.g. 49.98. */
  extractedValue?: number;
}

export type EngineKind = 'local' | 'llm';

export interface AnalysisMeta {
  engine: EngineKind;
  /** True when the LLM engine failed and LocalEngine produced the findings. */
  fellBack: boolean;
  analysedOn: ISODate;
}

export interface Evidence {
  id: EvidenceId;
  source: EvidenceSource;
  receivedOn: ISODate;
  title: string;
  body: string;
  submittedBy: UserId;
  findings: Finding[];
  /** Absent until the agent has run on this evidence. */
  analysis?: AnalysisMeta;
}

/** Input shape for a new signal before it has an id or findings. */
export type EvidenceDraft = Pick<Evidence, 'source' | 'receivedOn' | 'title' | 'body'>;

export interface SampleSignal extends EvidenceDraft {
  key: string;
  /** Short label for the one click list, e.g. "FrostLink rate notice". */
  label: string;
  /** What the presenter should expect, shown as a hint. */
  expectation: 'breaks' | 'shaky' | 'supports' | 'irrelevant';
}

/* ------------------------------------------------------------------ reopen briefs */

export type BriefStatus = 'draft' | 'sent' | 'actioned';

export interface BrokenAssumptionSummary {
  assumptionId: AssumptionId;
  statement: string;
  fromStatus: AssumptionStatus;
  toStatus: AssumptionStatus;
  confidence: number;
  rationale: string;
}

export interface OptionComparison {
  incumbentValue: number;
  optionValue: number;
  unit: string;
  /** optionValue minus incumbentValue. */
  delta: number;
  /** Plain English, e.g. "SGD 45.00 vs SGD 49.98 per pallet, 9.9 percent cheaper". */
  text: string;
}

export interface RevivedOption {
  optionId: RejectedOptionId;
  whyItIsLiveAgain: string;
  /** Null when the option was killed by a condition test, which has no figure to compare. */
  newComparison: OptionComparison | null;
}

export interface ReopenBrief {
  id: BriefId;
  decisionId: DecisionId;
  createdOn: ISODate;
  triggeringEvidenceId: EvidenceId;
  whatChanged: string;
  brokenAssumptions: BrokenAssumptionSummary[];
  impactStatement: string;
  revivedOptions: RevivedOption[];
  /** Options checked but not revived, with the reason, so the brief shows judgement. */
  consideredOptions: { optionId: RejectedOptionId; reason: string }[];
  /** Other decisions reopened by the same evidence. */
  relatedDecisionIds: DecisionId[];
  notifyList: UserId[];
  recommendedNextStep: string;
  /** Deadline the next step is keyed to, e.g. notice date before auto renewal. */
  actionBy?: ISODate;
  status: BriefStatus;
  sentOn?: ISODate;
}

/* ------------------------------------------------------------------ reasoning engine and trace */

export type TraceStepKind =
  | 'read'
  | 'extract'
  | 'match'
  | 'test'
  | 'verdict'
  | 'status'
  | 'revive'
  | 'draft'
  | 'noop';

export type TraceTone = 'info' | 'ok' | 'warn' | 'alert';

export interface TraceStep {
  kind: TraceStepKind;
  title: string;
  /** Supporting lines, e.g. the arithmetic "42.00 x 1.19 = 49.98". */
  lines: string[];
  tone: TraceTone;
  assumptionId?: AssumptionId;
  decisionId?: DecisionId;
}

export type TraceSink = (step: TraceStep) => void;

export type ClaimKind = 'percent-change' | 'absolute-value' | 'date' | 'keyword';

export interface ExtractedClaim {
  kind: ClaimKind;
  /** Exact source text span. */
  raw: string;
  /** Plain English, e.g. "rate increase of 19 percent effective 1 November". */
  summary: string;
  value?: number;
  /** Canonical unit word for quantities: 'percent', 'km', 'pallets', 'days', ... */
  unit?: string;
  /** Set for currency amounts. */
  currency?: 'SGD';
  /** The X in "per X" or "a X" following the figure, singular, e.g. 'pallet'. */
  per?: string;
  direction?: 'increase' | 'decrease';
  /** For dates, the ISO date; for changes, the date they take effect. */
  effectiveDate?: ISODate;
  /** Role inferred from context. */
  tag?: 'effective-date' | 'notice-period';
  /** Index into the normalised sentences the claim was found in. */
  sentence: number;
  /** Character offsets within that sentence. */
  start: number;
  end: number;
}

/**
 * The SPEC interface, with an optional trace sink so implementations can emit the
 * intermediate steps the UI animates. Callers that ignore the trace still conform.
 */
export interface ReasoningEngine {
  readonly kind: EngineKind;
  analyse(evidence: Evidence, assumptions: Assumption[], onTrace?: TraceSink): Promise<Finding[]>;
}

export interface AssumptionChange {
  assumptionId: AssumptionId;
  from: AssumptionStatus;
  to: AssumptionStatus;
  confidence: number;
  currentValue?: number;
}

export interface DecisionChange {
  decisionId: DecisionId;
  from: DecisionStatus;
  to: DecisionStatus;
}

/** Everything one agent run produces. The reducer applies it in one step. */
export interface AgentRunResult {
  evidence: Evidence;
  trace: TraceStep[];
  assumptionChanges: AssumptionChange[];
  decisionChanges: DecisionChange[];
  revivedOptionIds: RejectedOptionId[];
  briefs: ReopenBrief[];
  engineUsed: EngineKind;
  fellBack: boolean;
}

/* ------------------------------------------------------------------ settings */

export interface ConfidenceThresholds {
  /** Minimum confidence for a contradicting finding to mark an assumption broken. */
  broken: number;
  /** Minimum confidence for a contradicting finding to mark it shaky. Below this, ignored. */
  shaky: number;
  /** Threshold tests: within this fraction of the limit counts as shaky, e.g. 0.03. */
  shakyMargin: number;
}

export interface LlmSettings {
  /** Stored in localStorage only. Never seeded, never exported. */
  apiKey: string;
  /** OpenAI compatible chat completions URL. */
  endpoint: string;
  model: string;
  timeoutMs: number;
}

export interface Settings {
  engine: EngineKind;
  llm: LlmSettings;
  thresholds: ConfidenceThresholds;
  /** Delay between trace steps. */
  traceStepMs: number;
}

/* ------------------------------------------------------------------ session and auth */

export type AuthStage = 'password' | 'mfa' | 'authenticated';

export interface Lockout {
  failedAttempts: number;
  /** Epoch ms. Null when not locked. */
  lockedUntil: number | null;
}

export type AuthErrorKind = 'bad-credentials' | 'bad-code' | 'locked';

export interface AuthError {
  kind: AuthErrorKind;
  /** Attempts left before lockout, for bad-credentials and bad-code. */
  attemptsLeft: number;
}

export interface Session {
  stage: AuthStage;
  /** Set after a correct password, before MFA. */
  pendingUserId: UserId | null;
  userId: UserId | null;
  /** One lockout counter shared by both login steps (DECISIONS.md). */
  lockout: Lockout;
  /** The last failed attempt, cleared on success or when leaving the step. */
  error: AuthError | null;
  /** Username to prefill on the login screen, set by the role switcher. */
  loginHint: string | null;
}

/* ------------------------------------------------------------------ navigation */

export type Screen =
  | { name: 'login' }
  | { name: 'mfa' }
  | { name: 'portfolio' }
  | { name: 'decision'; decisionId: DecisionId }
  | { name: 'inbox' }
  | { name: 'brief'; briefId: BriefId }
  | { name: 'my-decisions' }
  | { name: 'contributor' }
  | { name: 'settings' };

export type ScreenName = Screen['name'];

/* ------------------------------------------------------------------ store */

export interface DomainData {
  users: Record<UserId, User>;
  decisions: Record<DecisionId, Decision>;
  assumptions: Record<AssumptionId, Assumption>;
  rejectedOptions: Record<RejectedOptionId, RejectedOption>;
  evidence: Record<EvidenceId, Evidence>;
  briefs: Record<BriefId, ReopenBrief>;
}

export interface AppState extends DomainData {
  /** Bumped when the persisted shape changes; mismatches reload the seed. */
  schemaVersion: number;
  settings: Settings;
  session: Session;
  screen: Screen;
  /** Last agent run, kept so the inbox can show its trace and summary after navigation. */
  lastRun: AgentRunResult | null;
  /**
   * Incremented by every Reset demo. An agent run started before a reset carries the old
   * epoch and is discarded, so a reset during the trace animation can never be undone by it.
   */
  epoch: number;
  /** Sample key the signal inbox should load on arrival (set by the demo loader). */
  inboxPreload: string | null;
}

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

/* ------------------------------------------------------------------ dashboard */

export interface PortfolioMetrics {
  active: number;
  watch: number;
  reopen: number;
  valueAtRisk: number;
  brokenLast30Days: number;
  /** Null when there are no break to reopen pairs yet. */
  medianDaysBreakToReopen: number | null;
}

export interface AssumptionHealth {
  holding: number;
  shaky: number;
  broken: number;
}
