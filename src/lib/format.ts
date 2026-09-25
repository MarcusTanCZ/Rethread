// Formatting helpers: SGD currency, tabular numbers, percentages, ISO date display, relative days.
import type { ISODate } from '../types';
import { datePart, daysBetween, today } from './clock';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 1240000 -> "1,240,000"; decimals fixed when given. */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-SG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** 1240000 -> "SGD 1,240,000". */
export function formatSGD(n: number, decimals = 0): string {
  return `SGD ${formatNumber(n, decimals)}`;
}

/** 4300000 -> "SGD 4.30m", 240000 -> "SGD 240k". For tiles where space is tight. */
export function formatSGDCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `SGD ${(n / 1_000_000).toFixed(2)}m`;
  if (Math.abs(n) >= 1_000) return `SGD ${Math.round(n / 1_000)}k`;
  return formatSGD(n);
}

/** 0.91 -> "0.91". Confidence is always shown to two places. */
export function formatConfidence(c: number): string {
  return c.toFixed(2);
}

/** 19 -> "19%"; 0.034 with fraction=true -> "3.4%". */
export function formatPercent(n: number, decimals = 0, fraction = false): string {
  return `${(fraction ? n * 100 : n).toFixed(decimals)}%`;
}

/** "2026-03-12" or a datetime -> "12 Mar 2026". */
export function formatDate(iso: ISODate): string {
  const [y, m, d] = datePart(iso).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2026-11-01" -> "1 November 2026". For prose such as rationales and briefs. */
export function formatLongDate(iso: ISODate): string {
  const [y, m, d] = datePart(iso).split('-');
  return `${Number(d)} ${LONG_MONTHS[Number(m) - 1]} ${y}`;
}

/** "2026-10-01" -> "1 October". */
export function formatDayMonth(iso: ISODate): string {
  const [, m, d] = datePart(iso).split('-');
  return `${Number(d)} ${LONG_MONTHS[Number(m) - 1]}`;
}

/** Datetime -> "12 Mar 2026, 09:30" in the timestamp's own offset. */
export function formatDateTime(iso: ISODate): string {
  const time = iso.length > 10 ? iso.slice(11, 16) : '';
  return time ? `${formatDate(iso)}, ${time}` : formatDate(iso);
}

/** Relative to the demo date: "today", "3 days ago", "in 37 days". */
export function formatRelative(iso: ISODate): string {
  const d = daysBetween(today(), iso);
  if (d === 0) return 'today';
  if (d === -1) return 'yesterday';
  if (d === 1) return 'tomorrow';
  return d < 0 ? `${-d} days ago` : `in ${d} days`;
}
