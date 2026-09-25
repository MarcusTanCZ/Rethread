// Reopen brief composer: whatChanged, impact statement, revived options with comparisons, notify list, recommended next step.
import type {
  Assumption,
  AssumptionChange,
  BriefId,
  Decision,
  DecisionId,
  Evidence,
  ExtractedClaim,
  ISODate,
  ReopenBrief,
  RejectedOption,
  User,
  UserId,
} from '../types';
import { addDays, daysBetween, today } from '../lib/clock';
import { formatDayMonth, formatLongDate, formatSGD } from '../lib/format';
import type { RevivalResult } from './revival';

const SOURCE_NOUN: Record<Evidence['source'], string> = {
  email: 'Email', 'meeting-note': 'Meeting note', metric: 'Metric report', regulatory: 'Regulatory notice', news: 'News item', manual: 'Manual entry',
};

export interface BriefInput {
  id: BriefId;
  createdOn: ISODate;
  decision: Decision;
  evidence: Evidence;
  claims: ExtractedClaim[];
  /** Post run state of the decision's assumptions. */
  assumptions: Assumption[];
  /** Changes this run made to the decision's assumptions. */
  changes: AssumptionChange[];
  revivals: RevivalResult[];
  options: Record<string, RejectedOption>;
  users: Record<UserId, User>;
  relatedDecisionIds: DecisionId[];
}

function quoted(titles: string[]): string {
  const q = titles.map((t) => `"${t}"`);
  return q.length <= 1 ? q.join('') : `${q.slice(0, -1).join(', ')} and ${q[q.length - 1]}`;
}

/** Owner first, then stakeholders, without duplicates. */
export function notifyListFor(decision: Pick<Decision, 'owner' | 'stakeholders'>): UserId[] {
  return [...new Set([decision.owner, ...decision.stakeholders])];
}

export function composeBrief(input: BriefInput): ReopenBrief {
  const { decision, evidence, assumptions, changes, revivals, options, users } = input;
  const byId = new Map(assumptions.map((a) => [a.id, a]));
  const finding = (id: string) => evidence.findings.find((f) => f.assumptionId === id);

  const broken = changes
    .filter((c) => c.to === 'broken')
    .map((c) => {
      const a = byId.get(c.assumptionId)!;
      return {
        assumptionId: c.assumptionId,
        statement: a.statement,
        fromStatus: c.from,
        toStatus: c.to,
        confidence: c.confidence,
        rationale: finding(c.assumptionId)?.rationale ?? '',
      };
    });

  const whatChanged =
    `${SOURCE_NOUN[evidence.source]} "${evidence.title}", received ${formatLongDate(evidence.receivedOn)}. ` +
    broken.map((b) => b.rationale).join(' ');

  const criticalBroken = assumptions.filter((a) => a.criticality === 'critical' && a.status === 'broken');
  const daysToReview = daysBetween(today(), decision.reviewDate);
  const impactStatement =
    `${decision.title} no longer stands on its original case: ${criticalBroken.length} critical assumption${criticalBroken.length === 1 ? ' is' : 's are'} broken ` +
    `(${criticalBroken.map((a) => a.id).join(', ')}). ${formatSGD(decision.valueAtRisk)} is at risk` +
    (daysToReview >= 0 && daysToReview <= 90 ? `, and the review date of ${formatLongDate(decision.reviewDate)} is ${daysToReview} days away.` : '.');

  const revived = revivals.filter((r) => r.revivable);
  const revivedTitles = revived.map((r) => options[r.optionId]!.title);

  // A notice period in the signal sets the deadline: notice must land before the review date
  // less the notice period, so the brief asks for it the day before that (DECISIONS.md).
  const notice = input.claims.find((c) => c.tag === 'notice-period');
  const counterparty = broken
    .map((b) => byId.get(b.assumptionId)!.test)
    .flatMap((t) => (t.kind === 'threshold' ? t.scope : t.keywords))[0];
  let actionBy: ISODate;
  let recommendedNextStep: string;
  if (notice?.value) {
    actionBy = addDays(decision.reviewDate, -(notice.value + 1));
    recommendedNextStep =
      `Give ${counterparty ?? 'the counterparty'} notice before ${formatDayMonth(actionBy)} so the contract does not renew on the revised terms` +
      (revived.length ? `, then compare against ${quoted(revivedTitles)} at current prices.` : ', then decide whether to renew.');
  } else {
    actionBy = addDays(today(), 7);
    const owner = users[decision.owner]?.name ?? 'The owner';
    recommendedNextStep =
      `${owner} to review ${decision.id} with the notify list by ${formatDayMonth(actionBy)}` +
      (revived.length ? ` and re-evaluate ${quoted(revivedTitles)}.` : ' and decide whether to reaffirm or replace it.');
  }

  return {
    id: input.id,
    decisionId: decision.id,
    createdOn: input.createdOn,
    triggeringEvidenceId: evidence.id,
    whatChanged,
    brokenAssumptions: broken,
    impactStatement,
    revivedOptions: revived.map((r) => ({ optionId: r.optionId, whyItIsLiveAgain: r.reason, newComparison: r.comparison })),
    consideredOptions: revivals.filter((r) => !r.revivable).map((r) => ({ optionId: r.optionId, reason: r.reason })),
    relatedDecisionIds: input.relatedDecisionIds,
    notifyList: notifyListFor(decision),
    recommendedNextStep,
    actionBy,
    status: 'draft',
  };
}
