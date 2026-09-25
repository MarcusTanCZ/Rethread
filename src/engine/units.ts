// Quantity formatting and threshold comparison shared by the engine, revival check and brief.
import type { ExtractedClaim, ThresholdOperator, ThresholdTest } from '../types';
import { formatNumber } from '../lib/format';
import { singular } from './extract';

function decimalsOf(n: number): number {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : Math.min(2, s.length - i - 1);
}

export function isCurrencyUnit(unit: string): boolean {
  return /^SGD\b/i.test(unit.trim());
}

/** Decimal places for comparing values in a unit: SGD rates to 2 places, others as written. */
export function decimalsFor(unit: string, ...values: number[]): number {
  if (isCurrencyUnit(unit)) return values.every((v) => Math.abs(v) >= 1000) ? 0 : 2;
  return Math.max(0, ...values.map(decimalsOf));
}

/** A bare number in the unit's precision: 42 -> "42.00" for SGD per pallet. */
export function fmt(v: number, unit: string, ...alongside: number[]): string {
  return formatNumber(v, decimalsFor(unit, v, ...alongside));
}

/** A number with its unit: "SGD 49.98 per pallet", "1.17 percent", "203 km per charge". */
export function formatQuantity(v: number, unit: string, ...alongside: number[]): string {
  const n = fmt(v, unit, ...alongside);
  if (isCurrencyUnit(unit)) {
    const rest = unit.trim().slice(3).trim();
    return `SGD ${n}${rest ? ` ${rest}` : ''}`;
  }
  return `${n} ${unit}`;
}

export function operatorNoun(op: ThresholdOperator): string {
  return op === '<=' ? 'ceiling' : op === '>=' ? 'floor' : 'target';
}

export function passes(test: Pick<ThresholdTest, 'operator' | 'value' | 'tolerance'>, v: number): boolean {
  const eps = 1e-9;
  if (test.operator === '<=') return v <= test.value + eps;
  if (test.operator === '>=') return v >= test.value - eps;
  return Math.abs(v - test.value) <= (test.tolerance ?? 0) + eps;
}

/**
 * Headroom as a fraction of the threshold: positive when passing, negative when failing.
 * For '<=' 1.17 against 1.2 is 0.025; 49.98 against 42 is -0.19.
 */
export function headroom(test: Pick<ThresholdTest, 'operator' | 'value' | 'tolerance'>, v: number): number {
  const t = Math.abs(test.value) || 1;
  if (test.operator === '<=') return (test.value - v) / t;
  if (test.operator === '>=') return (v - test.value) / t;
  return ((test.tolerance ?? 0) - Math.abs(v - test.value)) / t;
}

/** Lower values are better for '<=' tests (costs), higher for '>=' (volumes, service levels). */
export function lowerIsBetter(op: ThresholdOperator): boolean {
  return op !== '>=';
}

/** Can an extracted absolute figure be read as a value of this test's metric? */
export function unitMatches(claim: ExtractedClaim, test: ThresholdTest): boolean {
  const unit = test.unit.toLowerCase();
  const perMatch = /\bper\s+([a-z]+)/.exec(unit);
  const testPer = perMatch ? singular(perMatch[1]!) : undefined;
  if (testPer && claim.per !== testPer) return false;
  if (isCurrencyUnit(test.unit)) return claim.currency === 'SGD';
  if (claim.currency) return false;
  if (unit.startsWith('percent')) return claim.unit === 'percent';
  return !!claim.unit && claim.unit !== 'percent' && unit.split(/\s+/).includes(claim.unit);
}
