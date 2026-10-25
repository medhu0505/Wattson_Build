// Energy forensics. Works out how much electricity the meter actually
// recorded each day, compares it with the usage that was reported, and
// flags anything unusual.
//
// Nothing in here knows which dates are "the answer". Give it different
// readings and it will find different anomalies (the tests check this).

// A day is a surge when its score is above this. 3.5 is the usual cut-off
// for the "modified z-score" used below.
export const SURGE_SCORE = 3.5;

// Reported and metered usage may disagree by this much (kWh) before we call
// it a mismatch, to allow for rounding.
export const MISMATCH_TOLERANCE = 0.5;

// Round to 2 decimal places. Subtracting decimals in JavaScript gives tiny
// errors (18505.3 - 18477.2 = 28.100000000001455), so we round them away.
export function round2(value) {
  return Math.round(value * 100) / 100;
}

// The middle value once sorted (for an even count, halfway between the two
// middle values). Unlike the average, one huge value can't drag it upwards.
export function median(values) {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// The typical distance from the median ("median absolute deviation").
export function medianAbsoluteDeviation(values) {
  const middle = median(values);
  return median(values.map((value) => Math.abs(value - middle)));
}

// How unusual each value is: about 0 means typical, bigger means stranger.
// This is the "modified z-score": (value - median) measured in units of the
// typical spread. It is not fooled by the very surge it is looking for.
export function surgeScores(values) {
  if (values.length === 0) return [];
  const middle = median(values);
  const spread = medianAbsoluteDeviation(values);

  if (spread > 0) {
    return values.map((value) => (0.6745 * (value - middle)) / spread);
  }

  // More than half the values are identical, so the spread above is 0.
  // Use the average distance from the median instead (the standard fallback).
  const averageDistance = values.reduce((total, value) => total + Math.abs(value - middle), 0) / values.length;
  if (averageDistance === 0) return values.map(() => 0); // every value the same: nothing unusual
  return values.map((value) => (value - middle) / (1.253314 * averageDistance));
}

// The full analysis.
// rows: [{ date, label, meterReading, reportedUsage, ... }] as in data/energy.json
//
// Returns:
//   days        – every row plus: metered (meter difference from the day
//                 before, or null), gap (reported minus metered), score, flags
//   surges      – days whose metered usage is far above typical
//   mismatches  – days where reported and metered usage disagree
//   unverified  – days with no earlier reading to check against
//   typical     – median metered usage (kWh)
//   spread      – median absolute deviation of metered usage (kWh)
//   totals      – reported vs metered totals over the days that can be checked
export function analyseEnergy(rows, { surgeScore = SURGE_SCORE, tolerance = MISMATCH_TOLERANCE } = {}) {
  // Work in date order, whatever order the rows came in.
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  // 1. Meter difference: today's reading minus yesterday's.
  const withMetered = ordered.map((row, index) => {
    const previous = ordered[index - 1];
    const canMeasure = previous !== undefined
      && Number.isFinite(previous.meterReading)
      && Number.isFinite(row.meterReading);
    const metered = canMeasure ? round2(row.meterReading - previous.meterReading) : null;
    const gap = metered !== null && Number.isFinite(row.reportedUsage)
      ? round2(row.reportedUsage - metered)
      : null;
    return { ...row, metered, gap };
  });

  // 2. Score every day that has a meter difference.
  const measured = withMetered.filter((day) => day.metered !== null);
  const meteredValues = measured.map((day) => day.metered);
  const scores = surgeScores(meteredValues);
  const scoreByDate = new Map(measured.map((day, index) => [day.date, round2(scores[index])]));

  // 3. Flag each day.
  const days = withMetered.map((day) => {
    const score = scoreByDate.has(day.date) ? scoreByDate.get(day.date) : null;
    const flags = [];
    if (day.metered === null) flags.push('unverified');
    if (score !== null && score > surgeScore) flags.push('surge');
    if (day.gap !== null && Math.abs(day.gap) > tolerance) flags.push('mismatch');
    return { ...day, score, flags };
  });

  const checkable = days.filter((day) => day.gap !== null);
  const reportedTotal = round2(checkable.reduce((total, day) => total + day.reportedUsage, 0));
  const meteredTotal = round2(checkable.reduce((total, day) => total + day.metered, 0));

  return {
    days,
    surges: days.filter((day) => day.flags.includes('surge')),
    mismatches: days.filter((day) => day.flags.includes('mismatch')),
    unverified: days.filter((day) => day.flags.includes('unverified')),
    typical: round2(median(meteredValues)),
    spread: round2(medianAbsoluteDeviation(meteredValues)),
    totals: {
      reported: reportedTotal,
      metered: meteredTotal,
      difference: round2(reportedTotal - meteredTotal),
    },
    settings: { surgeScore, tolerance },
  };
}
