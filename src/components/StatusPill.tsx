// Status pill for decision, assumption and brief statuses using semantic colours only.
import type { AssumptionStatus, BriefStatus, DecisionStatus } from '../types';

type Tone = 'green' | 'amber' | 'red' | 'slate' | 'dark';

const TONE: Record<Tone, string> = {
  green: 'bg-holding-50 text-holding-700 ring-holding-500/25',
  amber: 'bg-shaky-50 text-shaky-700 ring-shaky-500/30',
  red: 'bg-broken-50 text-broken-700 ring-broken-500/30',
  slate: 'bg-slate-100 text-slate-600 ring-slate-400/30',
  dark: 'bg-slate-800 text-white ring-slate-800',
};
const DOT: Record<Tone, string> = {
  green: 'bg-holding-500', amber: 'bg-shaky-500', red: 'bg-broken-500', slate: 'bg-slate-400', dark: 'bg-white',
};

function Pill({ tone, label, size = 'md' }: { tone: Tone; label: string; size?: 'sm' | 'md' }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${TONE[tone]} ${
      size === 'sm' ? 'h-[18px] px-1.5 text-[10.5px]' : 'h-5 px-2 text-[11px]'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden />
      {label}
    </span>
  );
}

const DECISION: Record<DecisionStatus, [Tone, string]> = {
  active: ['green', 'Active'],
  watch: ['amber', 'On watch'],
  reopen: ['red', 'Reopen'],
  superseded: ['slate', 'Superseded'],
  closed: ['slate', 'Closed'],
};
const ASSUMPTION: Record<AssumptionStatus, [Tone, string]> = {
  holding: ['green', 'Holding'],
  shaky: ['amber', 'Shaky'],
  broken: ['red', 'Broken'],
};
const BRIEF: Record<BriefStatus, [Tone, string]> = {
  draft: ['slate', 'Draft'],
  sent: ['dark', 'Sent'],
  actioned: ['green', 'Actioned'],
};

export const DecisionStatusPill = ({ status, size }: { status: DecisionStatus; size?: 'sm' | 'md' }) => (
  <Pill tone={DECISION[status][0]} label={DECISION[status][1]} size={size} />
);
export const AssumptionStatusPill = ({ status, size }: { status: AssumptionStatus; size?: 'sm' | 'md' }) => (
  <Pill tone={ASSUMPTION[status][0]} label={ASSUMPTION[status][1]} size={size} />
);
export const BriefStatusPill = ({ status, size }: { status: BriefStatus; size?: 'sm' | 'md' }) => (
  <Pill tone={BRIEF[status][0]} label={BRIEF[status][1]} size={size} />
);

export const decisionStatusLabel = (s: DecisionStatus) => DECISION[s][1];
