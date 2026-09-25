// Demo clock: a single now() used everywhere so relative metrics and dates are deterministic after Reset demo.
import type { ISODate } from '../types';

/** The fixed demo date. Every "today", "last 30 days" and new timestamp is anchored here. */
export const DEMO_DATE = '2026-09-25';

/** Singapore offset, used for every seeded and generated timestamp. */
export const TZ_OFFSET = '+08:00';

const DEMO_START_MS = Date.parse(`${DEMO_DATE}T09:00:00${TZ_OFFSET}`);
const DAY_MS = 86_400_000;

// The demo clock ticks forward from 09:00 on the demo date at real speed from page load,
// so several events in one session still get distinct, ordered timestamps.
const loadedAt = Date.now();

export function now(): Date {
  return new Date(DEMO_START_MS + (Date.now() - loadedAt));
}

/** Demo date as YYYY-MM-DD. */
export function today(): ISODate {
  return DEMO_DATE;
}

/** Demo clock as an ISO datetime with the Singapore offset, e.g. 2026-09-25T09:04:12+08:00. */
export function nowISO(): ISODate {
  return toLocalISO(now());
}

/** Formats an instant as YYYY-MM-DDTHH:mm:ss+08:00. */
export function toLocalISO(d: Date): ISODate {
  const sg = new Date(d.getTime() + 8 * 3_600_000);
  return `${sg.toISOString().slice(0, 19)}${TZ_OFFSET}`;
}

/** Seed helper: a Singapore local timestamp for a date and HH:mm. */
export function at(date: ISODate, time = '09:00'): ISODate {
  return `${date}T${time}:00${TZ_OFFSET}`;
}

/** Calendar date part (YYYY-MM-DD) of a date or datetime string. */
export function datePart(iso: ISODate): ISODate {
  return iso.slice(0, 10);
}

/** Whole calendar days from a to b, using date parts only. Positive when b is later. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = Date.parse(`${datePart(b)}T00:00:00Z`) - Date.parse(`${datePart(a)}T00:00:00Z`);
  return Math.round(ms / DAY_MS);
}

/** Date part of `date` shifted by n days. */
export function addDays(date: ISODate, n: number): ISODate {
  const d = new Date(Date.parse(`${datePart(date)}T00:00:00Z`) + n * DAY_MS);
  return d.toISOString().slice(0, 10);
}
