// A decision's assumptions: statement, criticality, status, confidence, last tested, the test in plain English and the last known figure.
import type { Assumption } from '../types';
import { describeTest, lastKnown } from '../lib/describe';
import { formatConfidence, formatDate } from '../lib/format';
import { AssumptionStatusPill } from './StatusPill';

function Confidence({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confidence ${formatConfidence(value)}`}>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <span className="block h-full bg-slate-600" style={{ width: `${value * 100}%` }} />
      </span>
      <span className="w-7 text-right text-[12px] tabular-nums text-slate-700">{formatConfidence(value)}</span>
    </span>
  );
}

export function AssumptionsList({ assumptions }: { assumptions: Assumption[] }) {
  return (
    <section className="card" aria-label="Assumptions">
      <header className="card-header">
        <h2 className="card-title">Assumptions</h2>
        <span className="text-[11.5px] text-slate-500">{assumptions.length} tracked</span>
      </header>
      <table className="w-full table-fixed text-left">
        <colgroup>
          <col className="w-[84px]" />
          <col />
          <col className="w-[92px]" />
          <col className="w-[88px]" />
          <col className="w-[90px]" />
        </colgroup>
        <thead className="border-b border-slate-100">
          <tr>
            <th className="th pl-4">ID</th>
            <th className="th">Assumption and test</th>
            <th className="th">Status</th>
            <th className="th text-right">Confidence</th>
            <th className="th pr-4 text-right">Last tested</th>
          </tr>
        </thead>
        <tbody>
          {assumptions.map((a) => {
            const known = lastKnown(a);
            return (
              <tr key={a.id} className={`border-b border-slate-100 last:border-0 ${a.status === 'broken' ? 'bg-broken-50/40' : ''}`}>
                <td className="td pl-4 align-top">
                  <div className="font-mono text-[11.5px] text-slate-500">{a.id}</div>
                  <span className={`mt-1 inline-block rounded px-1 text-[9.5px] font-semibold uppercase leading-4 tracking-wide ${
                    a.criticality === 'critical' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>{a.criticality}</span>
                </td>
                <td className="td align-top">
                  <div className="font-medium text-slate-900">{a.statement}</div>
                  <div className="mt-0.5 text-[12px] text-slate-500">
                    {describeTest(a)}
                    {known && <> Last known <span className="font-medium tabular-nums text-slate-700">{known}</span>.</>}
                  </div>
                </td>
                <td className="td align-top"><AssumptionStatusPill status={a.status} /></td>
                <td className="td text-right align-top"><Confidence value={a.confidence} /></td>
                <td className="td pr-4 text-right align-top text-[12px] tabular-nums text-slate-600">{formatDate(a.lastTestedOn)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
