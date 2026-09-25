// The six one click sample signals for the Signal inbox, including the FrostLink hero, a shaky one and an irrelevant one.
import type { SampleSignal } from '../types';

/**
 * Joins lines into paragraphs the way a mail client would display them. Header lines and
 * blank lines stay on their own, so "From:", "Subject:" and paragraph breaks survive.
 */
function unwrap(lines: string[]): string {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    const joinable = prev !== undefined && prev !== '' && line !== '' && !/^(From|To|Subject|Date):/.test(prev) && !/^(From|To|Subject|Date):/.test(line);
    if (joinable) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out.join('\n');
}

export const SAMPLE_SIGNALS: SampleSignal[] = [
  {
    key: 'frostlink-rate-notice',
    label: 'FrostLink rate notice',
    expectation: 'breaks',
    source: 'email',
    receivedOn: '2026-09-18',
    title: 'Notice of rate revision and Jurong consolidation',
    body: unwrap([
      'From: contracts@frostlink.example',
      'Subject: Notice of rate revision and Jurong consolidation',
      'Date: 2026-09-18',
      '',
      'Dear partner, effective 1 November 2026 our per pallet handling rate will increase by 19',
      'percent across all Singapore facilities. We are also consolidating our Jurong operation',
      'into the Tuas South site from the same date. Existing contracts renew on the revised',
      'schedule unless notice is given 30 days prior.',
    ]),
  },
  {
    // Shaky, not broken: 1.17 percent still clears the 1.2 percent ceiling on A-127, but by
    // less than the 3 percent margin. Daniel is a D-10 stakeholder, so this also works from
    // the contributor view.
    key: 'night-shift-quality',
    label: 'Night shift quality report',
    expectation: 'shaky',
    source: 'metric',
    receivedOn: '2026-09-22',
    title: 'Senoko night shift quality report, week 38',
    body: unwrap([
      'Senoko night shift quality report, week 38 (15 to 21 September 2026).',
      '',
      'The night shift pick error rate was 1.17 percent for the week across 5,400 cases picked.',
      'Most errors were chilled items picked from the wrong face during the 02:00 wave.',
      'The supervisor has added a second scan check from 29 September.',
    ]),
  },
  {
    // Irrelevant: a price rise and several dates, none tied to a tracked assumption.
    key: 'facilities-notice',
    label: 'Facilities notice',
    expectation: 'irrelevant',
    source: 'email',
    receivedOn: '2026-09-23',
    title: 'Level 3 pantry and canteen update',
    body: unwrap([
      'From: facilities@caldergroup.example',
      'Subject: Level 3 pantry and canteen update',
      '',
      'Hi all, the level 3 pantry will be closed on Friday 3 October while the coffee machine is',
      'replaced. Our canteen operator has also advised that set meal prices will rise by 5 percent',
      'from 1 October. The quarterly town hall moves to 14 October in the level 5 training room.',
    ]),
  },
  {
    key: 'frostlink-halal-renewal',
    label: 'FrostLink halal renewal',
    expectation: 'supports',
    source: 'regulatory',
    receivedOn: '2026-09-19',
    title: 'Halal certification renewal: FrostLink Tuas South',
    body: unwrap([
      'Certificate renewal notice.',
      '',
      'The halal certification for FrostLink Pte Ltd, Tuas South cold store, has been renewed for',
      'a further two years and is valid to 30 September 2028. No conditions are attached.',
    ]),
  },
  {
    key: 'kargo-licence',
    label: 'Kargo licence suspension',
    expectation: 'breaks',
    source: 'regulatory',
    receivedOn: '2026-09-21',
    title: 'Import licence suspension: Kargo Logistik',
    body: unwrap([
      'Notice to licensees.',
      '',
      'The import licence held by Kargo Logistik Sdn Bhd has been suspended with immediate effect',
      'while documentation irregularities are under investigation. Consignments lodged through',
      'Kargo will not be cleared until further notice.',
    ]),
  },
  {
    key: 'ev-telematics-september',
    label: 'EV telematics, September',
    expectation: 'supports',
    source: 'metric',
    receivedOn: '2026-09-24',
    title: 'EV fleet telematics, September to date',
    body: unwrap([
      'EV fleet telematics summary, 1 to 23 September 2026.',
      '',
      'Average real world range across the electric van pilot recovered to 203 km per charge.',
      'Energy cost averaged SGD 0.12 per km. There were no charging interruptions at the depot.',
    ]),
  },
];
