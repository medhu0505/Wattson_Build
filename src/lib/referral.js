// Checks the Discrepancy Referral form against the detector's findings.
// The right answers are never written down here: they come from
// analyseEnergy() in anomalies.js.

// Typed numbers may be off by this much (kWh) and still count.
export const REFERRAL_TOLERANCE = 0.1;

// Turn what the agent typed into a number. Accepts "2,684", " 30.7 " and
// "503.2 kWh". Returns NaN (not a number) if it can't be read.
export function parseKwh(text) {
  const cleaned = String(text ?? '')
    .trim()
    .replace(/\s*kwh$/i, '')   // drop a "kWh" on the end
    .replace(/[,\s]/g, '');    // drop thousands commas and spaces
  if (cleaned === '') return NaN;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : NaN;
}

const close = (a, b) => Math.abs(a - b) <= REFERRAL_TOLERANCE;

// values:   what the agent entered:
//           { surgeDate, surgeKwh, mismatchDate, mismatchReported, mismatchMetered }
// findings: the result of analyseEnergy()
//
// Returns { ok: true } or { ok: false, errors: { fieldName: message } }.
export function checkReferral(values, findings) {
  const errors = {};

  // --- The surge ---
  const surge = findings.surges.find((day) => day.date === values.surgeDate);
  if (!values.surgeDate) {
    errors.surgeDate = 'Choose the date of the surge.';
  } else if (!surge) {
    errors.surgeDate = 'The meter does not show a surge on that date.';
  }

  const surgeKwh = parseKwh(values.surgeKwh);
  if (Number.isNaN(surgeKwh)) {
    errors.surgeKwh = 'Enter the size of the surge in kWh, as a number.';
  } else if (surge && !close(surgeKwh, surge.metered)) {
    errors.surgeKwh = 'That is not what the meter recorded on that date.';
  }

  // --- The mismatch ---
  const mismatch = findings.mismatches.find((day) => day.date === values.mismatchDate);
  if (!values.mismatchDate) {
    errors.mismatchDate = 'Choose the date where the figures disagree.';
  } else if (!mismatch) {
    errors.mismatchDate = 'On that date the reported usage agrees with the meter.';
  }

  const reported = parseKwh(values.mismatchReported);
  if (Number.isNaN(reported)) {
    errors.mismatchReported = 'Enter the reported usage in kWh, as a number.';
  } else if (mismatch && !close(reported, mismatch.reportedUsage)) {
    errors.mismatchReported = 'That is not the usage the dossier reports for that date.';
  }

  const metered = parseKwh(values.mismatchMetered);
  if (Number.isNaN(metered)) {
    errors.mismatchMetered = 'Enter the metered usage in kWh, as a number.';
  } else if (mismatch && !close(metered, mismatch.metered)) {
    errors.mismatchMetered = 'That is not what the meter readings show for that date.';
  }

  const ok = Object.keys(errors).length === 0;
  return ok ? { ok } : { ok, errors };
}
