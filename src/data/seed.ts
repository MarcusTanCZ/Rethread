// Seed scenario for Calder Group: users, 12 decisions, 34 assumptions, 18 rejected options, 9 evidence items, history.
//
// buildSeed() returns fresh objects on every call, so Reset demo can never share references
// with mutated state. Evidence links on decisions and assumptions, and each assumption's
// lastTestedOn, are derived from the evidence findings so they cannot drift out of step.
import type {
  Assumption,
  AssumptionId,
  AssumptionStatus,
  ConditionTest,
  Decision,
  DecisionId,
  DecisionStatus,
  DomainData,
  Evidence,
  HistoryEntry,
  RejectedOption,
  ThresholdOperator,
  ThresholdTest,
  User,
  UserId,
} from '../types';
import { at } from '../lib/clock';

/* ------------------------------------------------------------------ users */

export const PRIYA: UserId = 'U-01';
export const JOANNE: UserId = 'U-02';
export const DANIEL: UserId = 'U-03';

const USERS: User[] = [
  { id: PRIYA, name: 'Priya Raman', role: 'executive', username: 'ceo', password: 'demo1234', avatarInitials: 'PR', title: 'Chief Executive' },
  { id: JOANNE, name: 'Joanne Lim', role: 'owner', username: 'jlim', password: 'demo1234', avatarInitials: 'JL', title: 'Head of Logistics' },
  { id: DANIEL, name: 'Daniel Tan', role: 'contributor', username: 'dtan', password: 'demo1234', avatarInitials: 'DT', title: 'Operations Coordinator' },
];

/* ------------------------------------------------------------------ builders */

function th(
  metric: string,
  operator: ThresholdOperator,
  value: number,
  unit: string,
  baseline: number,
  metricAliases: string[],
  scope: string[],
): ThresholdTest {
  return { kind: 'threshold', metric, operator, value, unit, baseline, metricAliases, scope };
}

function cond(keywords: string[], negativeKeywords: string[]): ConditionTest {
  return { kind: 'condition', keywords, negativeKeywords };
}

type AssumptionSeed = Omit<Assumption, 'lastTestedOn' | 'evidenceIds' | 'status' | 'confidence'> & {
  status?: AssumptionStatus;
  confidence?: number;
};

function A(
  id: AssumptionId,
  decisionId: DecisionId,
  criticality: Assumption['criticality'],
  statement: string,
  test: Assumption['test'],
  extra: Partial<Pick<Assumption, 'status' | 'confidence' | 'currentValue'>> = {},
): AssumptionSeed {
  const currentValue = extra.currentValue ?? (test.kind === 'threshold' ? test.baseline : undefined);
  return { id, decisionId, criticality, statement, test, ...extra, ...(currentValue !== undefined ? { currentValue } : {}) };
}

function RO(
  id: string,
  decisionId: DecisionId,
  title: string,
  description: string,
  rejectedBecause: string,
  rejectedBecauseAssumptionId: AssumptionId | null,
  comparableValue: number | null,
): RejectedOption {
  return { id, decisionId, title, description, rejectedBecause, rejectedBecauseAssumptionId, comparableValue, revivable: false };
}

type HistorySeed = Omit<HistoryEntry, 'id'>;

const created = (date: string, actorId: UserId): HistorySeed => ({
  at: at(date, '10:00'),
  kind: 'created',
  cause: 'Decision recorded',
  actorId,
  toStatus: 'active',
});

const assumptionMoved = (
  when: string,
  assumptionId: AssumptionId,
  from: AssumptionStatus,
  to: AssumptionStatus,
  evidenceId: string,
  cause: string,
): HistorySeed => ({
  at: when,
  kind: 'assumption-change',
  cause,
  actorId: null,
  assumptionId,
  fromAssumptionStatus: from,
  toAssumptionStatus: to,
  evidenceId,
});

const statusMoved = (
  when: string,
  from: DecisionStatus,
  to: DecisionStatus,
  cause: string,
  actorId: UserId | null,
  evidenceId?: string,
): HistorySeed => ({
  at: when,
  kind: 'status-change',
  cause,
  actorId,
  fromStatus: from,
  toStatus: to,
  ...(evidenceId ? { evidenceId } : {}),
});

type DecisionSeed = Omit<Decision, 'evidenceIds' | 'historyEntries'> & { history: HistorySeed[] };

/* ------------------------------------------------------------------ decisions */

const DECISIONS: DecisionSeed[] = [
  {
    id: 'D-01',
    title: 'Five year lease on Senoko regional distribution centre',
    summary:
      'Move ambient and chilled storage from Pandan to a 14,000 square metre JTC site at Senoko on a five year lease with a capped annual escalation.',
    decidedOn: '2025-11-04',
    owner: PRIYA,
    stakeholders: [JOANNE],
    status: 'active',
    valueAtRisk: 620_000,
    category: 'Property',
    reviewDate: '2027-05-01',
    assumptionIds: ['A-101', 'A-102', 'A-103'],
    rejectedOptionIds: ['RO-01', 'RO-02'],
    history: [created('2025-11-04', PRIYA)],
  },
  {
    id: 'D-02',
    title: 'ERP warehouse module with Tanjong Systems',
    summary:
      'Replace the legacy warehouse management system with the Tanjong Systems ERP module, fixed price implementation, local support included.',
    decidedOn: '2025-09-15',
    owner: PRIYA,
    stakeholders: [JOANNE],
    status: 'active',
    valueAtRisk: 380_000,
    category: 'Technology',
    reviewDate: '2026-12-15',
    assumptionIds: ['A-107', 'A-108', 'A-109'],
    rejectedOptionIds: ['RO-03', 'RO-04'],
    history: [
      created('2025-09-15', PRIYA),
      assumptionMoved(at('2026-02-03', '11:20'), 'A-108', 'holding', 'broken', 'E-02', 'A-108 broken by E-02: Tanjong announced its support desk moves to Manila'),
      statusMoved(at('2026-02-07', '16:00'), 'active', 'reopen', 'Reopened after A-108 broke', PRIYA, 'E-02'),
      assumptionMoved(at('2026-02-20', '14:30'), 'A-108', 'broken', 'holding', 'E-03', 'A-108 restored by E-03: Tanjong committed a two person Singapore desk'),
      statusMoved(at('2026-02-24', '10:00'), 'reopen', 'active', 'Reaffirmed after Tanjong support commitment written into the contract', PRIYA),
    ],
  },
  {
    id: 'D-03',
    title: 'Fixed price diesel contract with Petrolink, 18 months',
    summary: 'Lock fleet diesel at a fixed SGD 2.10 per litre for 18 months against a 38,000 litre monthly volume commitment.',
    decidedOn: '2026-01-20',
    owner: JOANNE,
    stakeholders: [PRIYA],
    status: 'active',
    valueAtRisk: 290_000,
    category: 'Procurement',
    reviewDate: '2027-07-20',
    assumptionIds: ['A-110', 'A-111', 'A-112'],
    rejectedOptionIds: ['RO-05'],
    history: [
      created('2026-01-20', JOANNE),
      assumptionMoved(at('2026-09-02', '08:45'), 'A-110', 'holding', 'broken', 'E-06', 'A-110 broken by E-06: market diesel fell to SGD 2.02 per litre, below the fixed SGD 2.10'),
      statusMoved(at('2026-09-04', '17:10'), 'active', 'reopen', 'Reopened after A-110 broke', JOANNE, 'E-06'),
      assumptionMoved(at('2026-09-12', '09:30'), 'A-110', 'broken', 'holding', 'E-09', 'A-110 restored by E-09: market recovered to SGD 2.18 and Petrolink agreed a quarterly reset'),
      statusMoved(at('2026-09-15', '11:00'), 'reopen', 'active', 'Reaffirmed with a quarterly price reset clause', JOANNE),
    ],
  },
  {
    id: 'D-04',
    title: 'Electric van pilot, 20 vehicles on lease',
    summary: 'Lease 20 electric vans for chilled deliveries from Senoko, charged overnight at the depot, to meet customer emissions clauses.',
    decidedOn: '2026-04-08',
    owner: JOANNE,
    stakeholders: [PRIYA, DANIEL],
    status: 'watch',
    valueAtRisk: 310_000,
    category: 'Fleet',
    reviewDate: '2027-04-08',
    assumptionIds: ['A-113', 'A-114', 'A-115'],
    rejectedOptionIds: ['RO-06', 'RO-07'],
    history: [
      created('2026-04-08', JOANNE),
      assumptionMoved(at('2026-09-10', '07:50'), 'A-113', 'holding', 'shaky', 'E-05', 'A-113 shaky after E-05: August range 184 km, within 3 percent of the 180 km floor'),
      statusMoved(at('2026-09-10', '07:50'), 'active', 'watch', 'Placed on watch after A-113 turned shaky', null, 'E-05'),
    ],
  },
  {
    id: 'D-05',
    title: 'Halal certified supplier panel for poultry',
    summary: 'Buy all poultry from a panel of three halal certified suppliers under a shared price schedule, reviewed yearly.',
    decidedOn: '2025-12-02',
    owner: PRIYA,
    stakeholders: [JOANNE],
    status: 'active',
    valueAtRisk: 260_000,
    category: 'Sourcing',
    reviewDate: '2026-12-02',
    assumptionIds: ['A-116', 'A-117', 'A-118'],
    rejectedOptionIds: ['RO-08'],
    history: [created('2025-12-02', PRIYA)],
  },
  {
    id: 'D-06',
    title: 'Outsource Johor last mile to Swiftly',
    summary: 'Hand Johor Bahru store deliveries to Swiftly on a per drop rate, with a 95 percent on time floor in the service level agreement.',
    decidedOn: '2026-02-16',
    owner: JOANNE,
    stakeholders: [PRIYA, DANIEL],
    status: 'watch',
    valueAtRisk: 240_000,
    category: 'Distribution',
    reviewDate: '2026-11-16',
    assumptionIds: ['A-119', 'A-120', 'A-121'],
    rejectedOptionIds: ['RO-09', 'RO-10'],
    history: [
      created('2026-02-16', JOANNE),
      assumptionMoved(at('2026-09-16', '08:10'), 'A-119', 'holding', 'shaky', 'E-07', 'A-119 shaky after E-07: August on time rate 95.8 percent, within 1 percent of the floor'),
      statusMoved(at('2026-09-16', '08:10'), 'active', 'watch', 'Placed on watch after A-119 turned shaky', null, 'E-07'),
    ],
  },
  {
    id: 'D-07',
    title: 'Single source cold chain with FrostLink, three year term',
    summary:
      'Consolidate all chilled and frozen handling with FrostLink at SGD 42.00 per pallet on a three year term that renews automatically on 1 November.',
    decidedOn: '2026-03-12',
    owner: JOANNE,
    stakeholders: [PRIYA],
    status: 'active',
    valueAtRisk: 1_240_000,
    category: 'Cold chain',
    reviewDate: '2026-11-01',
    assumptionIds: ['A-104', 'A-105', 'A-106'],
    rejectedOptionIds: ['RO-11', 'RO-12'],
    history: [created('2026-03-12', JOANNE)],
  },
  {
    id: 'D-08',
    title: 'Dynamic pricing pilot for HoReCa accounts',
    summary: 'Pilot weekly repricing on 400 hotel, restaurant and catering accounts instead of a flat list price increase.',
    decidedOn: '2026-05-05',
    owner: PRIYA,
    stakeholders: [JOANNE],
    status: 'active',
    valueAtRisk: 180_000,
    category: 'Commercial',
    reviewDate: '2026-11-05',
    assumptionIds: ['A-122', 'A-123'],
    rejectedOptionIds: ['RO-13'],
    history: [created('2026-05-05', PRIYA)],
  },
  {
    id: 'D-09',
    title: 'Cut dry goods range by 15 percent of SKUs',
    summary: 'Delist the slowest 15 percent of dry goods SKUs and move key accounts onto an agreed substitution list.',
    decidedOn: '2026-02-10',
    owner: PRIYA,
    stakeholders: [JOANNE, DANIEL],
    status: 'active',
    valueAtRisk: 210_000,
    category: 'Range',
    reviewDate: '2026-12-31',
    assumptionIds: ['A-124', 'A-125', 'A-126'],
    rejectedOptionIds: ['RO-14'],
    history: [
      created('2026-02-10', PRIYA),
      assumptionMoved(at('2026-05-11', '09:15'), 'A-124', 'holding', 'broken', 'E-04', 'A-124 broken by E-04: April revenue loss on delisted SKUs was 2.6 percent'),
      statusMoved(at('2026-05-20', '15:30'), 'active', 'reopen', 'Reopened after A-124 broke', PRIYA, 'E-04'),
      assumptionMoved(at('2026-06-05', '12:00'), 'A-124', 'broken', 'holding', 'E-08', 'A-124 restored by E-08: substitutions bring projected loss to 1.7 percent'),
      statusMoved(at('2026-06-10', '10:30'), 'reopen', 'active', 'Reaffirmed once key accounts accepted the substitution list', PRIYA),
    ],
  },
  {
    id: 'D-10',
    title: 'Night shift picking at Senoko',
    summary: 'Add a night picking shift at Senoko so chilled orders are staged before the 05:00 dispatch window.',
    decidedOn: '2026-06-01',
    owner: JOANNE,
    stakeholders: [PRIYA, DANIEL],
    status: 'active',
    valueAtRisk: 150_000,
    category: 'Operations',
    reviewDate: '2026-12-01',
    assumptionIds: ['A-127', 'A-128'],
    rejectedOptionIds: ['RO-15'],
    history: [created('2026-06-01', JOANNE)],
  },
  {
    id: 'D-11',
    title: 'Exclusive Malaysia import broker, Kargo Logistik',
    summary: 'Give Kargo Logistik the sole customs brokerage mandate for Malaysian imports in exchange for a 12 percent fee discount.',
    decidedOn: '2025-10-20',
    owner: JOANNE,
    stakeholders: [PRIYA],
    status: 'active',
    valueAtRisk: 230_000,
    category: 'Trade',
    reviewDate: '2026-10-20',
    assumptionIds: ['A-129', 'A-130', 'A-131'],
    rejectedOptionIds: ['RO-16', 'RO-17'],
    history: [created('2025-10-20', JOANNE)],
  },
  {
    id: 'D-12',
    title: 'Tighten customer credit terms from 45 to 30 days',
    summary: 'Move all trade customers to 30 day terms to release working capital ahead of the revolving facility renewal.',
    decidedOn: '2026-07-01',
    owner: PRIYA,
    stakeholders: [JOANNE],
    status: 'active',
    valueAtRisk: 190_000,
    category: 'Finance',
    reviewDate: '2027-01-01',
    assumptionIds: ['A-132', 'A-133', 'A-134'],
    rejectedOptionIds: ['RO-18'],
    history: [created('2026-07-01', PRIYA)],
  },
];

/* ------------------------------------------------------------------ assumptions */

const ASSUMPTIONS: AssumptionSeed[] = [
  // D-01 Senoko lease
  A('A-101', 'D-01', 'critical', 'Senoko lease escalation stays at or below 3 percent a year',
    th('senoko.lease_escalation', '<=', 3, 'percent a year', 2.5, ['escalation', 'rent review', 'rent increase'], ['Senoko'])),
  A('A-102', 'D-01', 'critical', 'Senoko site keeps its JTC industrial zoning approval',
    cond(['Senoko', 'JTC', 'zoning'], ['rezoned', 'revoked', 'not renewed', 'withdrawn'])),
  A('A-103', 'D-01', 'supporting', 'Senoko utilisation stays at or above 75 percent',
    th('senoko.utilisation', '>=', 75, 'percent', 82, ['utilisation', 'occupancy'], ['Senoko'])),

  // D-07 FrostLink (hero)
  A('A-104', 'D-07', 'critical', 'FrostLink unit rate stays at or below SGD 42.00 per pallet',
    th('frostlink.unit_rate', '<=', 42, 'SGD per pallet', 42, ['per pallet', 'pallet rate', 'handling rate', 'unit rate'], ['FrostLink']),
    { confidence: 0.86 }),
  A('A-105', 'D-07', 'critical', 'FrostLink retains halal certification',
    cond(['FrostLink', 'halal', 'certification'], ['certification lapsed', 'suspended', 'withdrawn', 'revoked'])),
  A('A-106', 'D-07', 'supporting', 'Our weekly cold chain volume stays at or above 800 pallets',
    th('calder.weekly_pallets', '>=', 800, 'pallets a week', 860, ['pallets a week', 'pallets per week', 'weekly volume'], ['cold chain', 'chilled'])),

  // D-02 Tanjong ERP
  A('A-107', 'D-02', 'critical', 'Tanjong implementation cost stays at or below SGD 380,000',
    th('tanjong.implementation_cost', '<=', 380_000, 'SGD', 352_000, ['implementation cost', 'project cost', 'change order'], ['Tanjong'])),
  A('A-108', 'D-02', 'critical', 'Tanjong keeps a local support team in Singapore',
    cond(['Tanjong', 'support', 'Singapore'], ['offshore', 'relocate', 'moves to', 'closing', 'exit'])),
  A('A-109', 'D-02', 'supporting', 'Go live slips by no more than 8 weeks',
    th('tanjong.go_live_slip', '<=', 8, 'weeks', 3, ['go live', 'slip', 'delay'], ['Tanjong'])),

  // D-03 Petrolink diesel
  A('A-110', 'D-03', 'critical', 'Market diesel price stays at or above our fixed SGD 2.10 per litre',
    th('diesel.market_price', '>=', 2.1, 'SGD per litre', 2.28, ['per litre', 'pump price', 'diesel price'], ['diesel']),
    { currentValue: 2.18, confidence: 0.82 }),
  A('A-111', 'D-03', 'supporting', 'Petrolink supply from the Jurong Island terminal stays uninterrupted',
    cond(['Petrolink', 'supply', 'Jurong Island'], ['shortage', 'force majeure', 'disruption', 'rationing'])),
  A('A-112', 'D-03', 'supporting', 'Fleet diesel use stays at or above the 38,000 litre monthly commitment',
    th('fleet.diesel_litres', '>=', 38_000, 'litres a month', 41_000, ['litres a month', 'fuel volume', 'consumption'], ['fleet'])),

  // D-04 EV vans (on watch)
  A('A-113', 'D-04', 'critical', 'EV van real world range stays at or above 180 km per charge',
    th('ev.range_km', '>=', 180, 'km per charge', 205, ['range', 'km per charge'], ['EV', 'electric van', 'telematics']),
    { status: 'shaky', confidence: 0.62, currentValue: 184 }),
  A('A-114', 'D-04', 'critical', 'Senoko depot keeps grid capacity for overnight charging',
    cond(['charging', 'grid', 'Senoko'], ['capacity cap', 'curtailment', 'load shedding', 'insufficient capacity'])),
  A('A-115', 'D-04', 'supporting', 'EV energy cost stays at or below SGD 0.14 per km',
    th('ev.energy_cost', '<=', 0.14, 'SGD per km', 0.11, ['per km', 'energy cost'], ['EV', 'electric van', 'telematics'])),

  // D-05 Halal poultry panel
  A('A-116', 'D-05', 'critical', 'All three poultry panel suppliers retain halal certification',
    cond(['halal', 'poultry', 'panel supplier'], ['lapsed', 'suspended', 'withdrawn', 'revoked'])),
  A('A-117', 'D-05', 'critical', 'Panel poultry price stays at or below SGD 5.20 per kg',
    th('poultry.price_kg', '<=', 5.2, 'SGD per kg', 4.85, ['per kg', 'poultry price'], ['poultry'])),
  A('A-118', 'D-05', 'supporting', 'Panel fill rate stays at or above 96 percent',
    th('poultry.fill_rate', '>=', 96, 'percent', 98.1, ['fill rate'], ['poultry'])),

  // D-06 Swiftly Johor (on watch)
  A('A-119', 'D-06', 'critical', 'Swiftly on time delivery stays at or above 95 percent',
    th('swiftly.on_time', '>=', 95, 'percent', 97, ['on time', 'OTIF'], ['Swiftly']),
    { status: 'shaky', confidence: 0.6, currentValue: 95.8 }),
  A('A-120', 'D-06', 'supporting', 'Swiftly cost stays at or below SGD 11.50 per drop',
    th('swiftly.cost_per_drop', '<=', 11.5, 'SGD per drop', 10.9, ['per drop'], ['Swiftly'])),
  A('A-121', 'D-06', 'critical', 'Causeway customs clearance runs at normal processing times',
    cond(['Causeway', 'customs', 'Woodlands'], ['closure', 'strike', 'suspended', 'backlog'])),

  // D-08 HoReCa pricing
  A('A-122', 'D-08', 'critical', 'HoReCa churn stays at or below 4 percent a quarter',
    th('horeca.churn', '<=', 4, 'percent a quarter', 2.6, ['churn'], ['HoReCa'])),
  A('A-123', 'D-08', 'supporting', 'Pilot gross margin uplift stays at or above 1.5 points',
    th('horeca.margin_uplift', '>=', 1.5, 'margin points', 2.1, ['margin uplift', 'uplift'], ['pricing pilot'])),

  // D-09 Dry goods range
  A('A-124', 'D-09', 'critical', 'Revenue lost on delisted SKUs stays at or below 2 percent',
    th('range.revenue_loss', '<=', 2, 'percent', 1.2, ['revenue loss', 'sales loss'], ['delisted', 'SKU']),
    { currentValue: 1.7, confidence: 0.78 }),
  A('A-125', 'D-09', 'supporting', 'Warehouse pick rate gain stays at or above 8 percent',
    th('range.pick_rate_gain', '>=', 8, 'percent', 11, ['pick rate'], ['dry goods'])),
  A('A-126', 'D-09', 'critical', 'Key accounts accept the substitution list',
    cond(['substitution', 'key account'], ['rejected', 'refused', 'penalty', 'will delist'])),

  // D-10 Night shift
  A('A-127', 'D-10', 'critical', 'Night shift pick error rate stays at or below 1.2 percent',
    th('senoko.night_error_rate', '<=', 1.2, 'percent', 0.9, ['error rate', 'pick error', 'mispick'], ['night shift'])),
  A('A-128', 'D-10', 'supporting', 'Night shift premium stays at or below 1.5 times base rate',
    th('senoko.night_premium', '<=', 1.5, 'times base rate', 1.35, ['premium', 'shift allowance'], ['night shift'])),

  // D-11 Kargo brokerage
  A('A-129', 'D-11', 'critical', 'Kargo Logistik keeps its import licence',
    cond(['Kargo', 'licence', 'import'], ['suspended', 'revoked', 'cancelled', 'under investigation'])),
  A('A-130', 'D-11', 'supporting', 'Kargo brokerage fee stays at or below SGD 85 per shipment',
    th('kargo.fee', '<=', 85, 'SGD per shipment', 78, ['brokerage', 'per shipment'], ['Kargo'])),
  A('A-131', 'D-11', 'supporting', 'Kargo clearance time stays at or below 36 hours',
    th('kargo.clearance_hours', '<=', 36, 'hours', 22, ['clearance time'], ['Kargo'])),

  // D-12 Credit terms
  A('A-132', 'D-12', 'critical', 'No more than 3 trade accounts are lost to the terms change',
    th('credit.accounts_lost', '<=', 3, 'accounts', 1, ['accounts lost', 'lost accounts'], ['credit terms'])),
  A('A-133', 'D-12', 'supporting', 'Days sales outstanding stays at or below 38 days',
    th('credit.dso', '<=', 38, 'days', 36, ['DSO', 'days sales outstanding'], ['DSO', 'receivables'])),
  A('A-134', 'D-12', 'supporting', 'The revolving credit facility is renewed on current terms',
    cond(['revolving facility', 'renewal', 'financing'], ['not renewed', 'withdrawn', 'reduced', 'covenant breach'])),
];

/* ------------------------------------------------------------------ rejected options */

const REJECTED_OPTIONS: RejectedOption[] = [
  RO('RO-01', 'D-01', 'Stay in Pandan on a two year extension',
    'Keep the existing Pandan site and extend the lease by two years.',
    'The Pandan landlord asked for a 6 percent annual escalation against 2.5 percent at Senoko.', 'A-101', 6),
  RO('RO-02', 'D-01', 'Third party warehouse in Tuas',
    'Use a 3PL shared warehouse in Tuas on a pay per pallet basis.',
    'The 3PL could not ring fence chilled capacity during the December peak.', null, null),
  RO('RO-03', 'D-02', 'Extend the legacy WMS for two years',
    'Keep the current warehouse system on extended support and defer the ERP.',
    'The legacy vendor ends support in 2027, so an extension only postpones a second migration.', null, null),
  RO('RO-04', 'D-02', 'Kestrel Cloud WMS subscription',
    'Subscribe to a cloud warehouse system instead of an ERP module.',
    'Kestrel quoted SGD 455,000 over the same term, 20 percent above Tanjong.', 'A-107', 455_000),
  RO('RO-05', 'D-03', 'Buy diesel at market with no hedge',
    'Stay on pump prices and accept monthly volatility.',
    'The board wanted cost certainty after the 2025 fuel price spike.', null, null),
  RO('RO-06', 'D-04', 'Hybrid diesel vans',
    'Lease 20 hybrid vans, which need no depot charging.',
    'Hybrids cut emissions by only 25 percent, short of the 50 percent customer clause.', null, null),
  RO('RO-07', 'D-04', 'Delay electrification to 2028',
    'Keep the diesel fleet until battery prices fall further.',
    'Would have lost the Harbourline Grocers tender, which requires a low emission fleet from 2027.', null, null),
  RO('RO-08', 'D-05', 'Single supplier with Sinar Poultry',
    'Buy all poultry from one certified supplier at a volume discount.',
    'Single source concentration risk on a halal critical line.', null, null),
  RO('RO-09', 'D-06', 'Keep Johor deliveries in house',
    'Run Johor deliveries with our own vans and drivers.',
    'In house cost was SGD 13.40 per drop against Swiftly at SGD 10.90.', 'A-120', 13.4),
  RO('RO-10', 'D-06', 'Split Johor between Swiftly and Kinta Express',
    'Use two carriers to reduce dependency on Swiftly.',
    'Kinta ran 91 percent on time in the trial, below the 95 percent floor.', 'A-119', 91),
  RO('RO-11', 'D-07', 'Dual source with Nordvale and FrostLink',
    'Split cold chain volume between Nordvale and FrostLink to keep a second supplier warm.',
    'Nordvale quoted SGD 45.00 per pallet, 7 percent above FrostLink.', 'A-104', 45),
  RO('RO-12', 'D-07', 'Build own cold store at Tuas',
    'Build and operate a Calder owned cold store at Tuas.',
    'Capital cost of SGD 6.8 million.', null, null),
  RO('RO-13', 'D-08', 'Across the board 3 percent list price increase',
    'Raise HoReCa list prices by 3 percent in one step.',
    'Modelled churn of 7 percent a quarter, above the 4 percent ceiling.', 'A-122', 7),
  RO('RO-14', 'D-09', 'Cut 30 percent of dry goods SKUs',
    'Delist twice as many SKUs for a larger picking gain.',
    'Modelled revenue loss of 4.5 percent, above the 2 percent ceiling.', 'A-124', 4.5),
  RO('RO-15', 'D-10', 'Weekend day shifts instead of nights',
    'Stage chilled orders on Saturday and Sunday day shifts.',
    'Weekend premium of 1.8 times base rate, above the 1.5 cap.', 'A-128', 1.8),
  RO('RO-16', 'D-11', 'Two broker panel with Kargo and Meridian Clear',
    'Split Malaysian import clearance between two brokers.',
    'The 12 percent fee discount is only available while Kargo holds the sole mandate.', 'A-129', null),
  RO('RO-17', 'D-11', 'Clear imports in house with our own licence',
    'Hold our own import licence and employ two customs declarants.',
    'Licence and staffing cost works out at SGD 140 per shipment.', 'A-130', 140),
  RO('RO-18', 'D-12', 'Offer a 2 percent early payment discount instead',
    'Keep 45 day terms and pay customers to settle early.',
    'The discount would cost SGD 260,000 a year against a SGD 190,000 working capital benefit.', null, null),
];

/* ------------------------------------------------------------------ historical evidence */

const EVIDENCE: Evidence[] = [
  {
    id: 'E-01',
    source: 'email',
    receivedOn: '2026-03-05',
    title: 'Nordvale cold chain quotation',
    body:
      'From: sales@nordvale.example\nSubject: Quotation for chilled and frozen handling\n\nFurther to our site visit, Nordvale can offer chilled and frozen handling at SGD 45.00 per pallet for a three year term, with capacity for up to 900 pallets a week from January.',
    submittedBy: JOANNE,
    findings: [
      {
        assumptionId: 'A-104',
        verdict: 'supports',
        confidence: 0.86,
        rationale: 'Nordvale quotes SGD 45.00 per pallet, so FrostLink at SGD 42.00 remains the cheaper option and within the SGD 42.00 ceiling.',
        extractedValue: 45,
      },
    ],
  },
  {
    id: 'E-02',
    source: 'news',
    receivedOn: '2026-02-03',
    title: 'Tanjong Systems to relocate support desk to Manila',
    body:
      'Tanjong Systems said on Monday it will relocate its Singapore customer support team to a regional hub in Manila by the end of the second quarter, as part of a cost programme.',
    submittedBy: PRIYA,
    findings: [
      {
        assumptionId: 'A-108',
        verdict: 'contradicts',
        confidence: 0.88,
        rationale: 'The article says Tanjong will relocate its Singapore support team to Manila, which contradicts a local support team.',
      },
    ],
  },
  {
    id: 'E-03',
    source: 'meeting-note',
    receivedOn: '2026-02-20',
    title: 'Tanjong account review: Singapore support commitment',
    body:
      'Tanjong confirmed a two person Singapore support desk dedicated to Calder for the full contract term, written into a side letter. Remote support from Manila covers after hours only.',
    submittedBy: PRIYA,
    findings: [
      {
        assumptionId: 'A-108',
        verdict: 'supports',
        confidence: 0.84,
        rationale: 'Tanjong committed in writing to a two person Singapore support desk for the contract term.',
      },
    ],
  },
  {
    id: 'E-04',
    source: 'metric',
    receivedOn: '2026-05-11',
    title: 'Delisted SKU revenue report, April',
    body:
      'April range report. Revenue loss on the 212 delisted dry goods SKUs was 2.6 percent of category sales, mainly from two key accounts that did not accept substitutes.',
    submittedBy: DANIEL,
    findings: [
      {
        assumptionId: 'A-124',
        verdict: 'contradicts',
        confidence: 0.9,
        rationale: 'Revenue loss on delisted SKUs was 2.6 percent, above the 2 percent ceiling.',
        extractedValue: 2.6,
      },
    ],
  },
  {
    id: 'E-05',
    source: 'metric',
    receivedOn: '2026-09-10',
    title: 'EV fleet telematics, August',
    body:
      'EV fleet telematics summary for August 2026. Average real world range across the electric van pilot was 184 km per charge, down from 205 km in June, as air conditioning load rose. Energy cost averaged SGD 0.12 per km.',
    submittedBy: DANIEL,
    findings: [
      {
        assumptionId: 'A-113',
        verdict: 'contradicts',
        confidence: 0.62,
        rationale: 'Average range of 184 km per charge still clears the 180 km floor, but is within 3 percent of it.',
        extractedValue: 184,
      },
      {
        assumptionId: 'A-115',
        verdict: 'supports',
        confidence: 0.8,
        rationale: 'Energy cost of SGD 0.12 per km is below the SGD 0.14 ceiling.',
        extractedValue: 0.12,
      },
    ],
  },
  {
    id: 'E-06',
    source: 'metric',
    receivedOn: '2026-09-02',
    title: 'Diesel market price, week 35',
    body: 'Weekly fuel index. Average diesel pump price across Singapore fell to SGD 2.02 per litre, the lowest level since 2024.',
    submittedBy: JOANNE,
    findings: [
      {
        assumptionId: 'A-110',
        verdict: 'contradicts',
        confidence: 0.9,
        rationale: 'Market diesel at SGD 2.02 per litre is below our fixed SGD 2.10, so the fixed contract is now above market.',
        extractedValue: 2.02,
      },
    ],
  },
  {
    id: 'E-07',
    source: 'metric',
    receivedOn: '2026-09-16',
    title: 'Swiftly Johor service report, August',
    body:
      'Swiftly monthly service report for Johor Bahru, August 2026. On time delivery was 95.8 percent across 3,140 drops. Cost held at SGD 10.90 per drop. Two late waves were caused by congestion at Woodlands.',
    submittedBy: DANIEL,
    findings: [
      {
        assumptionId: 'A-119',
        verdict: 'contradicts',
        confidence: 0.6,
        rationale: 'On time delivery of 95.8 percent clears the 95 percent floor by less than 1 percent.',
        extractedValue: 95.8,
      },
      {
        assumptionId: 'A-120',
        verdict: 'supports',
        confidence: 0.82,
        rationale: 'Cost of SGD 10.90 per drop is below the SGD 11.50 ceiling.',
        extractedValue: 10.9,
      },
    ],
  },
  {
    id: 'E-08',
    source: 'meeting-note',
    receivedOn: '2026-06-05',
    title: 'Key account review: substitution list agreed',
    body:
      'Both key accounts accepted the revised substitution list. With substitutes in place, projected revenue loss on delisted SKUs falls to 1.7 percent for the rest of the year.',
    submittedBy: PRIYA,
    findings: [
      {
        assumptionId: 'A-126',
        verdict: 'supports',
        confidence: 0.85,
        rationale: 'Both key accounts accepted the revised substitution list.',
      },
      {
        assumptionId: 'A-124',
        verdict: 'supports',
        confidence: 0.78,
        rationale: 'Projected revenue loss of 1.7 percent is back under the 2 percent ceiling.',
        extractedValue: 1.7,
      },
    ],
  },
  {
    id: 'E-09',
    source: 'email',
    receivedOn: '2026-09-12',
    title: 'Petrolink: quarterly reset clause agreed',
    body:
      'From: accounts@petrolink.example\nSubject: Contract variation\n\nFollowing our call, Petrolink agrees to add a quarterly price reset to the fixed diesel contract. Market diesel has recovered to SGD 2.18 per litre this week.',
    submittedBy: JOANNE,
    findings: [
      {
        assumptionId: 'A-110',
        verdict: 'supports',
        confidence: 0.82,
        rationale: 'Market diesel at SGD 2.18 per litre is back above our fixed SGD 2.10.',
        extractedValue: 2.18,
      },
    ],
  },
];

/* ------------------------------------------------------------------ assembly */

const DEFAULT_CONFIDENCE: Record<AssumptionStatus, number> = { holding: 0.8, shaky: 0.6, broken: 0.9 };

export function buildSeed(): DomainData {
  const evidence = structuredClone(EVIDENCE);
  const decisionsById = new Map(DECISIONS.map((d) => [d.id, d]));

  const assumptions: Record<string, Assumption> = {};
  for (const seed of ASSUMPTIONS) {
    const touching = evidence
      .filter((e) => e.findings.some((f) => f.assumptionId === seed.id))
      .sort((a, b) => a.receivedOn.localeCompare(b.receivedOn));
    const status = seed.status ?? 'holding';
    const last = touching[touching.length - 1];
    assumptions[seed.id] = structuredClone({
      ...seed,
      status,
      confidence: seed.confidence ?? DEFAULT_CONFIDENCE[status],
      lastTestedOn: last ? last.receivedOn : decisionsById.get(seed.decisionId)!.decidedOn,
      evidenceIds: touching.map((e) => e.id),
    });
  }

  let historySeq = 0;
  const decisions: Record<string, Decision> = {};
  for (const { history, ...d } of DECISIONS) {
    const evidenceIds = evidence
      .filter((e) => e.findings.some((f) => assumptions[f.assumptionId]?.decisionId === d.id))
      .sort((a, b) => a.receivedOn.localeCompare(b.receivedOn))
      .map((e) => e.id);
    const historyEntries = history.map((h) => ({ id: `H-${String(++historySeq).padStart(3, '0')}`, ...structuredClone(h) }));
    decisions[d.id] = { ...structuredClone(d), evidenceIds, historyEntries };
  }

  return {
    users: Object.fromEntries(USERS.map((u) => [u.id, { ...u }])),
    decisions,
    assumptions,
    rejectedOptions: Object.fromEntries(REJECTED_OPTIONS.map((o) => [o.id, { ...o }])),
    evidence: Object.fromEntries(evidence.map((e) => [e.id, e])),
    briefs: {},
  };
}
