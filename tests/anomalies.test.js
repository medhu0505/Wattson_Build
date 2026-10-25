// Tests for the energy anomaly detector.
// The first group runs on the real dossier data; the rest use made-up data
// to prove the detector isn't just remembering the right answers.

import { describe, it, expect } from 'vitest';
import {
  analyseEnergy, median, medianAbsoluteDeviation, surgeScores, round2,
} from '../src/lib/anomalies.js';
import energy from '../data/energy.json';

// Build rows from a starting meter reading and a list of daily usages.
// reported can override what was "reported" for particular days.
function makeRows(start, usages, reported = {}) {
  let reading = start;
  return usages.map((usage, index) => {
    if (index > 0) reading = round2(reading + usage);
    const date = `2026-01-${String(index + 1).padStart(2, '0')}`;
    return { date, label: date, meterReading: reading, reportedUsage: reported[date] ?? usage };
  });
}

describe('the real dossier data', () => {
  const result = analyseEnergy(energy.rows);
  const day = (date) => result.days.find((d) => d.date === date);

  it('works out every meter difference', () => {
    const expected = [null, 28.1, 22.9, 31.4, 26.7, 35.2, 29.8, 23.5, 27.6, 25.1, 2684, 30.7, 21.8, 28.9];
    expect(result.days.map((d) => d.metered)).toEqual(expected);
  });

  it('detects the Oct 23 surge of 2684 kWh', () => {
    expect(result.surges).toHaveLength(1);
    expect(result.surges[0].date).toBe('2026-10-23');
    expect(result.surges[0].metered).toBe(2684);
  });

  it('detects the Oct 24 mismatch: reported 503.2, metered 30.7', () => {
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toMatchObject({
      date: '2026-10-24', reportedUsage: 503.2, metered: 30.7, gap: 472.5,
    });
  });

  it('does not flag Oct 23 as a mismatch: its report agrees with the meter', () => {
    expect(day('2026-10-23').flags).toEqual(['surge']);
  });

  it('does not flag the busiest ordinary day (Oct 18, 35.2 kWh)', () => {
    expect(day('2026-10-18').flags).toEqual([]);
    expect(day('2026-10-18').score).toBeLessThan(3.5);
  });

  it('marks Oct 13 as unverifiable (no earlier reading)', () => {
    expect(result.unverified.map((d) => d.date)).toEqual(['2026-10-13']);
  });

  it('reports the typical day and spread', () => {
    expect(result.typical).toBe(28.1);
    expect(result.spread).toBe(3);
  });

  it('finds the same 472.5 kWh gap in the totals', () => {
    expect(result.totals).toEqual({ reported: 3488.2, metered: 3015.7, difference: 472.5 });
  });
});

describe('the detector is not hard-coded', () => {
  const quiet = [20, 22, 21, 23, 19, 22, 20, 21, 24, 20];

  it('finds a surge on a different day in different data', () => {
    const usages = [...quiet];
    usages[3] = 900;
    const result = analyseEnergy(makeRows(1000, usages));
    expect(result.surges.map((d) => d.date)).toEqual(['2026-01-04']);
    expect(result.mismatches).toEqual([]);
  });

  it('finds a mismatch on a different day in different data', () => {
    const result = analyseEnergy(makeRows(1000, quiet, { '2026-01-07': 75 }));
    expect(result.mismatches.map((d) => d.date)).toEqual(['2026-01-07']);
    expect(result.mismatches[0].gap).toBe(55);
    expect(result.surges).toEqual([]);
  });

  it('flags nothing in ordinary data', () => {
    const result = analyseEnergy(makeRows(1000, quiet));
    expect(result.surges).toEqual([]);
    expect(result.mismatches).toEqual([]);
  });

  it('gives the same answer when the rows arrive shuffled', () => {
    const shuffled = [...energy.rows].reverse();
    expect(analyseEnergy(shuffled).surges[0].date).toBe('2026-10-23');
    expect(analyseEnergy(shuffled).mismatches[0].date).toBe('2026-10-24');
  });

  it('lets the cut-offs be changed', () => {
    const result = analyseEnergy(energy.rows, { tolerance: 500 });
    expect(result.mismatches).toEqual([]); // a 472.5 gap is now inside the tolerance
  });
});

describe('edge cases', () => {
  it('copes with no rows at all', () => {
    const result = analyseEnergy([]);
    expect(result.days).toEqual([]);
    expect(result.surges).toEqual([]);
    expect(result.typical).toBeNaN();
  });

  it('copes with a single row (nothing to compare it to)', () => {
    const result = analyseEnergy([{ date: '2026-01-01', meterReading: 5, reportedUsage: 5 }]);
    expect(result.days[0].metered).toBeNull();
    expect(result.days[0].flags).toEqual(['unverified']);
  });

  it('allows small rounding differences between reported and metered', () => {
    const rows = makeRows(1000, [20, 21, 22], { '2026-01-02': 21.4, '2026-01-03': 22.6 });
    const result = analyseEnergy(rows);
    expect(result.mismatches.map((d) => d.date)).toEqual(['2026-01-03']); // 0.4 is fine, 0.6 is not
  });

  it('skips a missing meter reading instead of inventing a number', () => {
    const rows = makeRows(1000, [20, 21, 22, 23]);
    rows[2] = { ...rows[2], meterReading: null };
    const result = analyseEnergy(rows);
    expect(result.days[2].metered).toBeNull(); // can't measure the missing day
    expect(result.days[3].metered).toBeNull(); // or the day after it
    expect(result.days[1].metered).toBe(21);
  });

  it('still finds a surge when most days are identical', () => {
    const result = analyseEnergy(makeRows(0, [25, 25, 25, 25, 25, 500]));
    expect(result.spread).toBe(0);
    expect(result.surges.map((d) => d.date)).toEqual(['2026-01-06']);
  });

  it('flags nothing when every day is identical', () => {
    const result = analyseEnergy(makeRows(0, [25, 25, 25, 25, 25]));
    expect(result.surges).toEqual([]);
  });
});

describe('the maths helpers', () => {
  it('median handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });

  it('median absolute deviation ignores one huge value', () => {
    expect(medianAbsoluteDeviation([10, 11, 12, 13, 1000])).toBe(1);
  });

  it('scores a typical value near 0 and a huge one very high', () => {
    const [typical, , , , huge] = surgeScores([10, 11, 12, 13, 1000]);
    expect(Math.abs(typical)).toBeLessThan(3.5);
    expect(huge).toBeGreaterThan(100);
  });

  it('round2 removes floating-point noise', () => {
    expect(18505.3 - 18477.2).not.toBe(28.1);
    expect(round2(18505.3 - 18477.2)).toBe(28.1);
  });
});
