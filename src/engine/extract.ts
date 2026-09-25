// Text extraction: numbers with units, percentage changes with direction, currency amounts, dates and notice periods from an evidence body.
//
// Everything here is plain regular expressions over normalised sentences, so the same text
// always yields the same claims in the same order.
import type { ExtractedClaim, ISODate } from '../types';
import { formatLongDate, formatNumber } from '../lib/format';

/* ------------------------------------------------------------------ sentences */

const HEADER_LINE = /^(from|to|cc|subject|date|sent):/i;

/**
 * Splits a body into sentences. Email header lines stand alone, blank lines end a paragraph,
 * and line breaks inside a paragraph are joined so "19\npercent" reads as "19 percent".
 */
export function sentences(body: string): string[] {
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    const text = para.join(' ').replace(/\s+/g, ' ').trim();
    para = [];
    if (!text) return;
    // A full stop ends a sentence unless it sits inside a number such as 2.02.
    for (const m of text.matchAll(/(?:[^.!?]|\.(?=\d))+(?:[.!?](?!\d)|$)/g)) {
      const s = m[0].trim();
      if (s) out.push(s);
    }
  };
  for (const raw of body.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) flush();
    else if (HEADER_LINE.test(line)) {
      flush();
      out.push(line);
    } else para.push(line);
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ term matching */

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole word, case insensitive, tolerant of a plural: "SKU" matches "SKUs", "EV" does not match "level". */
export function termPattern(term: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${escape(term)}(?:s|es)?(?![A-Za-z0-9])`, 'i');
}

export function hasTerm(text: string, term: string): boolean {
  return termPattern(term).test(text);
}

/** Position of the first match of term in text, or -1. */
export function termIndex(text: string, term: string): number {
  const m = termPattern(term).exec(text);
  return m ? m.index : -1;
}

/* ------------------------------------------------------------------ numbers and units */

const NUM = String.raw`\d[\d,]*(?:\.\d+)?`;

function parseNum(s: string): number {
  return Number(s.replace(/,/g, ''));
}

const UNIT_ALIASES: Record<string, string> = {
  km: 'km', kilometre: 'km', kilometres: 'km', kilometer: 'km', kilometers: 'km',
  pallet: 'pallets', pallets: 'pallets',
  litre: 'litres', litres: 'litres', liter: 'litres', liters: 'litres',
  hour: 'hours', hours: 'hours', day: 'days', days: 'days', week: 'weeks', weeks: 'weeks',
  month: 'months', months: 'months', case: 'cases', cases: 'cases', drop: 'drops', drops: 'drops',
  kg: 'kg', times: 'times', account: 'accounts', accounts: 'accounts', point: 'points', points: 'points',
  shipment: 'shipments', shipments: 'shipments',
};

/** Singular form of the word after "per", so "per pallets" and "per pallet" compare equal. */
export function singular(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

const PER = String.raw`(?:\s+(?:per|a|an)\s+([a-z]+))?`;

/* ------------------------------------------------------------------ dates */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const DMY = new RegExp(String.raw`\b(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day\s+)?(\d{1,2})\s+(${MONTH_NAMES})\b(?:\s+(\d{4}))?`, 'gi');
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

function iso(y: number, m: number, d: number): ISODate {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const EFFECTIVE_BEFORE = /\b(?:effective|from|with effect from|starting|as of|as from)\s+(?:on\s+)?$/i;

/* ------------------------------------------------------------------ changes */

const UP_WORDS = 'increase|increases|increased|increasing|rise|rises|rising|rose|risen|raise|raised|up|grow|grows|grew|higher|hike|hikes';
const DOWN_WORDS = 'decrease|decreases|decreased|decreasing|fall|falls|fell|fallen|drop|drops|dropped|decline|declines|declined|reduce|reduces|reduced|reduction|cut|cuts|down|lower|soften|softens|softened';
const CHANGE_BEFORE = new RegExp(String.raw`\b(${UP_WORDS}|${DOWN_WORDS})\s+(?:by\s+)?(?:about\s+|around\s+|roughly\s+|some\s+)?$`, 'i');
const CHANGE_AFTER = new RegExp(String.raw`^\s+(increase|rise|hike|uplift|decrease|reduction|cut|drop|fall|decline)\b`, 'i');
const DOWN_SET = new Set(DOWN_WORDS.split('|'));
const AUX = new Set(['will', 'to', 'is', 'are', 'was', 'were', 'has', 'have', 'had', 'been', 'be', 'would', 'shall', 'set', 'by']);

/** The noun a change applies to: "our per pallet handling rate will increase" -> "rate". */
function changeSubject(before: string): string | null {
  const words = before.replace(/[^A-Za-z\s]/g, ' ').trim().split(/\s+/);
  words.pop(); // the verb itself
  while (words.length && AUX.has(words[words.length - 1]!.toLowerCase())) words.pop();
  const w = words[words.length - 1];
  return w && w.length > 2 ? w.toLowerCase() : null;
}

/* ------------------------------------------------------------------ extraction */

function overlaps(spans: [number, number][], s: number, e: number): boolean {
  return spans.some(([a, b]) => s < b && e > a);
}

export interface Extraction {
  sentences: string[];
  claims: ExtractedClaim[];
}

/**
 * Extracts claims from a body. `fallbackYear` fills dates written without a year, such as
 * "from 1 October", from the evidence's own received date.
 */
export function extractClaims(body: string, fallbackYear: number): Extraction {
  const ss = sentences(body);
  const claims: ExtractedClaim[] = [];

  ss.forEach((s, si) => {
    const taken: [number, number][] = [];
    const local: ExtractedClaim[] = [];
    const push = (c: ExtractedClaim) => {
      taken.push([c.start, c.end]);
      local.push(c);
    };

    // Dates first, so their day numbers are never read as quantities.
    for (const m of s.matchAll(ISO)) {
      const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      const date = iso(y, mo, d);
      const effective = EFFECTIVE_BEFORE.test(s.slice(0, m.index));
      push({ kind: 'date', raw: m[0], summary: `${effective ? 'effective ' : 'date '}${formatLongDate(date)}`, effectiveDate: date,
        ...(effective ? { tag: 'effective-date' as const } : {}), sentence: si, start: m.index!, end: m.index! + m[0].length });
    }
    for (const m of s.matchAll(DMY)) {
      const d = Number(m[1]);
      const mo = MONTHS[m[2]!.toLowerCase()]!;
      if (d < 1 || d > 31) continue;
      const date = iso(m[3] ? Number(m[3]) : fallbackYear, mo, d);
      const effective = EFFECTIVE_BEFORE.test(s.slice(0, m.index));
      push({ kind: 'date', raw: m[0], summary: `${effective ? 'effective ' : 'date '}${formatLongDate(date)}`, effectiveDate: date,
        ...(effective ? { tag: 'effective-date' as const } : {}), sentence: si, start: m.index!, end: m.index! + m[0].length });
    }

    // Currency amounts: "SGD 45.00 per pallet", "S$6.8 million".
    for (const m of s.matchAll(new RegExp(String.raw`(?:SGD|S\$|\$)\s?(${NUM})(?:\s*(million|m|thousand|k)\b)?${PER}`, 'gi'))) {
      if (overlaps(taken, m.index!, m.index! + m[0].length)) continue;
      const scale = { million: 1e6, m: 1e6, thousand: 1e3, k: 1e3 }[(m[2] ?? '').toLowerCase()] ?? 1;
      const value = parseNum(m[1]!) * scale;
      const per = m[3] ? singular(m[3]) : undefined;
      const shown = value >= 1000 ? formatNumber(value) : formatNumber(value, 2);
      push({ kind: 'absolute-value', raw: m[0], summary: `SGD ${shown}${per ? ` per ${per}` : ''}`, value, currency: 'SGD',
        ...(per ? { per } : {}), sentence: si, start: m.index!, end: m.index! + m[0].length });
    }

    // Percentages: a change ("increase by 19 percent", "a 5 percent rise") or a level ("1.17 percent").
    for (const m of s.matchAll(new RegExp(String.raw`(${NUM})\s*(?:percent|per cent|%)`, 'gi'))) {
      if (overlaps(taken, m.index!, m.index! + m[0].length)) continue;
      const value = parseNum(m[1]!);
      const before = s.slice(0, m.index);
      const after = s.slice(m.index! + m[0].length);
      const verb = CHANGE_BEFORE.exec(before)?.[1] ?? CHANGE_AFTER.exec(after)?.[1];
      const start = m.index!;
      const end = start + m[0].length;
      if (verb) {
        const direction = DOWN_SET.has(verb.toLowerCase()) ? 'decrease' : 'increase';
        const subject = CHANGE_BEFORE.test(before) ? changeSubject(before.slice(0, CHANGE_BEFORE.exec(before)!.index + verb.length)) : null;
        push({ kind: 'percent-change', raw: m[0], summary: `${subject ? `${subject} ` : ''}${direction} of ${formatNumber(value, value % 1 ? 2 : 0)} percent`,
          value, unit: 'percent', direction, sentence: si, start, end });
      } else {
        push({ kind: 'absolute-value', raw: m[0], summary: `${formatNumber(value, value % 1 ? 2 : 0)} percent`, value, unit: 'percent', sentence: si, start, end });
      }
    }

    // Quantities with a known unit: "184 km per charge", "5,400 cases", "30 days".
    const unitWords = Object.keys(UNIT_ALIASES).sort((a, b) => b.length - a.length).join('|');
    for (const m of s.matchAll(new RegExp(String.raw`(?<![\w.])(${NUM})\s+(${unitWords})\b${PER}`, 'gi'))) {
      if (overlaps(taken, m.index!, m.index! + m[0].length)) continue;
      const value = parseNum(m[1]!);
      const unit = UNIT_ALIASES[m[2]!.toLowerCase()]!;
      const per = m[3] ? singular(m[3]) : undefined;
      const notice = unit === 'days' && /\bnotice\b/i.test(s);
      push({ kind: 'absolute-value', raw: m[0],
        summary: notice ? `notice period of ${formatNumber(value)} days` : `${formatNumber(value, value % 1 ? 2 : 0)} ${unit}${per ? ` per ${per}` : ''}`,
        value, unit, ...(per ? { per } : {}), ...(notice ? { tag: 'notice-period' as const } : {}), sentence: si, start: m.index!, end: m.index! + m[0].length });
    }

    // Attach an effective date in the same sentence to each change.
    const effective = local.find((c) => c.tag === 'effective-date');
    for (const c of local) {
      if (c.kind === 'percent-change' && effective?.effectiveDate) {
        c.effectiveDate = effective.effectiveDate;
        c.summary += ` effective ${formatLongDate(effective.effectiveDate)}`;
      }
    }

    claims.push(...local.sort((a, b) => a.start - b.start));
  });

  return { sentences: ss, claims };
}

/** Claim summaries for the trace, dropping effective dates already folded into a change. */
export function describeClaims(ex: Extraction): string[] {
  const folded = new Set(ex.claims.filter((c) => c.kind === 'percent-change' && c.effectiveDate).map((c) => `${c.sentence}:${c.effectiveDate}`));
  return ex.claims
    .filter((c) => !(c.kind === 'date' && c.tag === 'effective-date' && folded.has(`${c.sentence}:${c.effectiveDate}`)))
    .map((c) => c.summary);
}
