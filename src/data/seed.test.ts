import { describe, expect, it } from 'vitest';
import { buildSeed } from './seed';
import { SAMPLE_SIGNALS } from './samples';
import { checkSeed } from './checkSeed';

const failing = (data = buildSeed()) => checkSeed(data, SAMPLE_SIGNALS).filter((r) => !r.ok);

describe('seed consistency', () => {
  it('passes every check', () => {
    expect(failing()).toEqual([]);
  });

  it('returns fresh objects on each build', () => {
    const a = buildSeed();
    a.decisions['D-07']!.status = 'reopen';
    a.assumptions['A-104']!.evidenceIds.push('E-99');
    const b = buildSeed();
    expect(b.decisions['D-07']!.status).toBe('active');
    expect(b.assumptions['A-104']!.evidenceIds).not.toContain('E-99');
  });
});

// Proves the checker actually detects the faults it claims to.
describe('checkSeed catches broken seeds', () => {
  it('flags a decision referencing a missing assumption', () => {
    const d = buildSeed();
    d.decisions['D-01']!.assumptionIds.push('A-999');
    expect(failing(d).map((r) => r.name)).toContain('Every assumptionId on a decision exists and belongs to it');
  });

  it('flags a rejected option killed by another decision\'s assumption', () => {
    const d = buildSeed();
    d.rejectedOptions['RO-11']!.rejectedBecauseAssumptionId = 'A-101';
    expect(failing(d).map((r) => r.name)).toContain(
      'Every rejectedBecauseAssumptionId points to a real assumption on the same decision',
    );
  });

  it('flags a portfolio value far from SGD 4.3 million', () => {
    const d = buildSeed();
    d.decisions['D-07']!.valueAtRisk = 3_000_000;
    expect(failing(d).map((r) => r.name)).toContain('Portfolio value at risk is about SGD 4.3 million');
  });

  it('flags a history log that does not replay to the current status', () => {
    const d = buildSeed();
    d.decisions['D-04']!.status = 'active';
    expect(failing(d).map((r) => r.name)).toContain('History logs replay to each current status');
  });
});
