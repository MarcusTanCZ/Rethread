// Revivability check for rejected options: compares comparableValue against the broken assumption's new value.
import type { Assumption, OptionComparison, RejectedOption } from '../types';
import { formatNumber } from '../lib/format';
import { formatQuantity, isCurrencyUnit, lowerIsBetter } from './units';

export interface RevivalResult {
  optionId: string;
  revivable: boolean;
  /** Plain English: why it is live again, or why it stays closed. */
  reason: string;
  comparison: OptionComparison | null;
}

/**
 * An option is live again only when the assumption that killed it has broken and, for a
 * threshold assumption, the option's comparable figure now beats the incumbent's new figure.
 * Options rejected for reasons no tracked assumption covers (such as capital cost) stay closed.
 *
 * @param killer the assumption named in rejectedBecauseAssumptionId, in its post run state
 * @param incumbentValue the incumbent's new figure for that assumption's metric, if known
 */
export function evaluateRevival(option: RejectedOption, killer: Assumption | undefined, incumbentValue: number | undefined): RevivalResult {
  const closed = (reason: string): RevivalResult => ({ optionId: option.id, revivable: false, reason, comparison: null });

  if (!option.rejectedBecauseAssumptionId || !killer) {
    return closed(`Rejected on grounds this signal does not touch: ${option.rejectedBecause}`);
  }
  if (killer.status !== 'broken') {
    return closed(`It was rejected because ${killer.id} held, and ${killer.id} is still ${killer.status}.`);
  }

  if (killer.test.kind === 'condition') {
    return {
      optionId: option.id,
      revivable: true,
      reason: `It was rejected because ${killer.id} ("${killer.statement}") held. ${killer.id} is now broken, so that reason no longer applies.`,
      comparison: null,
    };
  }

  const test = killer.test;
  if (option.comparableValue === null || incumbentValue === undefined) {
    return closed(`${killer.id} is broken, but there is no comparable figure to test this option against.`);
  }

  const lower = lowerIsBetter(test.operator);
  const better = lower ? option.comparableValue < incumbentValue : option.comparableValue > incumbentValue;
  const q = (v: number) => formatQuantity(v, test.unit, option.comparableValue!, incumbentValue);
  const delta = Number((option.comparableValue - incumbentValue).toFixed(4));
  const pct = formatNumber((Math.abs(delta) / Math.abs(incumbentValue)) * 100, 1);
  const comparison: OptionComparison = {
    incumbentValue,
    optionValue: option.comparableValue,
    unit: test.unit,
    delta,
    text: `${q(option.comparableValue)} against ${q(incumbentValue)} now, ${pct} percent ${better === lower ? 'lower' : 'higher'}`,
  };

  if (!better) {
    return {
      optionId: option.id,
      revivable: false,
      reason: `${killer.id} is broken, but at ${q(option.comparableValue)} this option still does not beat the incumbent at ${q(incumbentValue)}.`,
      comparison,
    };
  }
  return {
    optionId: option.id,
    revivable: true,
    reason: `It was rejected at ${q(option.comparableValue)} because the incumbent held at ${q(test.baseline)}. The incumbent is now ${q(incumbentValue)}, so this option is ${pct} percent ${lower ? (isCurrencyUnit(test.unit) ? 'cheaper' : 'lower') : 'higher'}.`,
    comparison,
  };
}
