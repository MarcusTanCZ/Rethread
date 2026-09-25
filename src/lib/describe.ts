// Plain English descriptions of assumption tests and helpers for naming users and sources.
import type { Assumption, EvidenceSource, UserId, User } from '../types';
import { formatQuantity } from '../engine/units';

/** "Breaks if it rises above SGD 42.00 per pallet." / "Breaks if the signal reports: suspended, revoked." */
export function describeTest(a: Assumption): string {
  const t = a.test;
  if (t.kind === 'condition') {
    return `Watches for ${t.keywords.join(', ')}. Breaks on: ${t.negativeKeywords.join(', ')}.`;
  }
  const limit = formatQuantity(t.value, t.unit);
  const rule = t.operator === '<=' ? `Breaks above ${limit}` : t.operator === '>=' ? `Breaks below ${limit}` : `Breaks away from ${limit}`;
  return `${rule}. Changes are applied to the last known value.`;
}

/** The last known figure for a threshold assumption, formatted, or null. */
export function lastKnown(a: Assumption): string | null {
  if (a.test.kind !== 'threshold' || a.currentValue === undefined) return null;
  return formatQuantity(a.currentValue, a.test.unit, a.test.value);
}

export function userName(users: Record<UserId, User>, id: UserId | null): string {
  if (id === null) return 'Agent';
  return users[id]?.name ?? id;
}

export const SOURCE_LABEL: Record<EvidenceSource, string> = {
  email: 'Email',
  'meeting-note': 'Meeting note',
  metric: 'Metric',
  regulatory: 'Regulatory',
  news: 'News',
  manual: 'Manual',
};
