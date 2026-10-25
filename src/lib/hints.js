// Rules for hints: three per stage, shown one at a time. How many an agent
// has opened is saved in progress.hintsUsed and shown in the case report.

import { fillTemplate } from './text.js';
import { analyseEnergy } from './anomalies.js';
import { expectedKey } from './machineKey.js';
import { keyPinIds } from './evidence.js';

export const HINTS_PER_STAGE = 3;

// How many hints the agent has opened for a stage (0 to 3).
export function hintsUsed(progress, stageId) {
  const used = Number(progress.hintsUsed?.[stageId] ?? 0);
  return Math.min(HINTS_PER_STAGE, Math.max(0, Number.isFinite(used) ? Math.floor(used) : 0));
}

// Open the next hint for a stage. Returns NEW progress; stops at 3.
export function revealNextHint(progress, stageId) {
  const used = hintsUsed(progress, stageId);
  if (used >= HINTS_PER_STAGE) return progress;
  return { ...progress, hintsUsed: { ...progress.hintsUsed, [stageId]: used + 1 } };
}

// The values the {curly bracket} words in hints.json are filled with.
// Worked out from the data, never typed in, so the hints can't go wrong.
export function hintValues({ canon, energy }) {
  const analysis = analyseEnergy(energy.rows);
  const surge = analysis.surges[0];
  const mismatch = analysis.mismatches[0];
  const kwh = (value) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
  const keyLabels = keyPinIds(canon.pins).map((id) => canon.pins[id].label);

  return {
    keyDetails: keyLabels.join('; '),
    surgeLabel: surge?.label ?? 'none found',
    surgeKwh: surge ? kwh(surge.metered) : '—',
    mismatchLabel: mismatch?.label ?? 'none found',
    reported: mismatch ? kwh(mismatch.reportedUsage) : '—',
    metered: mismatch ? kwh(mismatch.metered) : '—',
    machineId: canon.machine.id,
    key: expectedKey(canon.machine.id) ?? '—',
  };
}

// The hints for a stage, with the {words} filled in.
export function hintsFor(stageId, hints, values) {
  return (hints[stageId] ?? []).map((hint) => fillTemplate(hint, values));
}
