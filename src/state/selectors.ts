// Role scoped selectors. visibleDecisions(user) is the single source of truth for what each role may see, including value redaction.
//
// Every screen reads decisions, and anything hanging off a decision (assumptions, options,
// evidence, briefs), through these functions. Access is decided here on the data, never by
// hiding buttons: a screen that forgets to hide a value still cannot show one it never received.
import type {
  Assumption,
  AppState,
  Decision,
  DecisionId,
  DomainData,
  Evidence,
  ReopenBrief,
  RejectedOption,
  Role,
  User,
  VisibleDecision,
} from '../types';

type Data = Pick<DomainData, 'decisions'> & Partial<DomainData>;

/* ------------------------------------------------------------------ capabilities */

/** May this role see valueAtRisk on a decision it can already see? */
function roleSeesValues(role: Role): boolean {
  return role === 'executive' || role === 'owner';
}

function canSeeDecisionRecord(user: User, d: Decision): boolean {
  switch (user.role) {
    case 'executive':
      return true;
    case 'owner':
      return d.owner === user.id;
    case 'contributor':
      return d.stakeholders.includes(user.id);
    default:
      return false; // Unknown roles see nothing.
  }
}

export const canSeePortfolio = (user: User | null | undefined): boolean => user?.role === 'executive';
export const canSeeAdmin = (user: User | null | undefined): boolean => user?.role === 'executive';
/** Signal inbox and full agent trace. Contributors submit from their own view (DECISIONS.md). */
export const canUseInbox = (user: User | null | undefined): boolean =>
  user?.role === 'executive' || user?.role === 'owner';
export const canSubmitEvidence = (user: User | null | undefined): boolean => !!user;

/* ------------------------------------------------------------------ decisions */

function project(user: User, d: Decision): VisibleDecision {
  // Deep copy so a screen can never mutate store state through a selector result.
  const copy = structuredClone(d) as VisibleDecision;
  if (!roleSeesValues(user.role)) copy.valueAtRisk = null;
  return copy;
}

/**
 * Decisions this user may see, in id order, with valueAtRisk redacted to null where the role
 * may not see it.
 * - executive: every decision, with values
 * - owner: only decisions they own, with values
 * - contributor: only decisions listing them as a stakeholder, never values
 * No user, or an unrecognised role, sees nothing.
 */
export function visibleDecisions(data: Data, user: User | null | undefined): VisibleDecision[] {
  if (!user) return [];
  return Object.values(data.decisions)
    .filter((d) => canSeeDecisionRecord(user, d))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => project(user, d));
}

/** One decision if the user may see it, otherwise undefined. */
export function visibleDecision(data: Data, user: User | null | undefined, id: DecisionId): VisibleDecision | undefined {
  if (!user) return undefined;
  const d = data.decisions[id];
  return d && canSeeDecisionRecord(user, d) ? project(user, d) : undefined;
}

export function canSeeDecision(data: Data, user: User | null | undefined, id: DecisionId): boolean {
  const d = data.decisions[id];
  return !!user && !!d && canSeeDecisionRecord(user, d);
}

/* ------------------------------------------------------------------ records hanging off decisions */

function visibleIds(data: Data, user: User | null | undefined): Set<DecisionId> {
  return new Set(visibleDecisions(data, user).map((d) => d.id));
}

export function assumptionsFor(data: DomainData, user: User | null | undefined, decisionId: DecisionId): Assumption[] {
  if (!canSeeDecision(data, user, decisionId)) return [];
  return data.decisions[decisionId]!.assumptionIds.map((id) => data.assumptions[id]).filter((a): a is Assumption => !!a);
}

export function rejectedOptionsFor(
  data: DomainData,
  user: User | null | undefined,
  decisionId: DecisionId,
): RejectedOption[] {
  if (!canSeeDecision(data, user, decisionId)) return [];
  return data.decisions[decisionId]!.rejectedOptionIds
    .map((id) => data.rejectedOptions[id])
    .filter((o): o is RejectedOption => !!o);
}

/** Evidence on one visible decision, newest first, with findings limited to that decision. */
export function evidenceFor(data: DomainData, user: User | null | undefined, decisionId: DecisionId): Evidence[] {
  if (!canSeeDecision(data, user, decisionId)) return [];
  const own = new Set(data.decisions[decisionId]!.assumptionIds);
  return data.decisions[decisionId]!.evidenceIds
    .map((id) => data.evidence[id])
    .filter((e): e is Evidence => !!e)
    .map((e) => ({ ...e, findings: e.findings.filter((f) => own.has(f.assumptionId)) }))
    .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn));
}

/**
 * Reopen briefs the user may open. Executives see all; owners see briefs on decisions they
 * own (their reopen tasks); contributors see none.
 */
export function visibleBriefs(data: DomainData, user: User | null | undefined): ReopenBrief[] {
  if (!user || user.role === 'contributor') return [];
  const ids = visibleIds(data, user);
  return Object.values(data.briefs)
    .filter((b) => ids.has(b.decisionId))
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn));
}

/* ------------------------------------------------------------------ session */

const KNOWN_ROLES: ReadonlySet<string> = new Set<Role>(['executive', 'owner', 'contributor']);

/** The signed in user, or null. A user with an unrecognised role counts as signed out. */
export function currentUser(state: Pick<AppState, 'users' | 'session'>): User | null {
  const id = state.session?.stage === 'authenticated' ? state.session.userId : null;
  const user = id ? state.users?.[id] : undefined;
  return user && KNOWN_ROLES.has(user.role) ? user : null;
}
