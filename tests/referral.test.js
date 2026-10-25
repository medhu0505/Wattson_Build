// Tests for the Discrepancy Referral form, which unlocks Signal Decoder.

import { describe, it, expect } from 'vitest';
import { checkReferral, parseKwh } from '../src/lib/referral.js';
import { analyseEnergy } from '../src/lib/anomalies.js';
import { completeStage, createProgress, isUnlocked } from '../src/state/progress.js';
import energy from '../data/energy.json';

const findings = analyseEnergy(energy.rows);

const correct = {
  surgeDate: '2026-10-23',
  surgeKwh: '2684',
  mismatchDate: '2026-10-24',
  mismatchReported: '503.2',
  mismatchMetered: '30.7',
};

describe('reading typed numbers', () => {
  it('reads plain numbers, thousands commas, spaces and a kWh unit', () => {
    expect(parseKwh('2684')).toBe(2684);
    expect(parseKwh('2,684.00')).toBe(2684);
    expect(parseKwh(' 30.7 ')).toBe(30.7);
    expect(parseKwh('503.2 kWh')).toBe(503.2);
    expect(parseKwh('503.2KWH')).toBe(503.2);
  });

  it('refuses things that are not numbers', () => {
    expect(parseKwh('')).toBeNaN();
    expect(parseKwh('lots')).toBeNaN();
    expect(parseKwh('12abc')).toBeNaN();
    expect(parseKwh(undefined)).toBeNaN();
  });
});

describe('checking the referral', () => {
  it('accepts the right answers', () => {
    expect(checkReferral(correct, findings)).toEqual({ ok: true });
  });

  it('accepts numbers within 0.1 kWh, typed in other ways', () => {
    const result = checkReferral(
      { ...correct, surgeKwh: '2,684.00', mismatchReported: '503.25', mismatchMetered: '30.70 kWh' },
      findings
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a surge date where there was no surge', () => {
    const result = checkReferral({ ...correct, surgeDate: '2026-10-24' }, findings);
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors)).toEqual(['surgeDate']);
  });

  it('rejects the wrong surge size', () => {
    const result = checkReferral({ ...correct, surgeKwh: '2600' }, findings);
    expect(Object.keys(result.errors)).toEqual(['surgeKwh']);
  });

  it('rejects a mismatch date where the figures agree (Oct 23 agrees with its meter)', () => {
    const result = checkReferral({ ...correct, mismatchDate: '2026-10-23' }, findings);
    expect(Object.keys(result.errors)).toEqual(['mismatchDate']);
  });

  it('catches reported and metered figures swapped round', () => {
    const result = checkReferral({ ...correct, mismatchReported: '30.7', mismatchMetered: '503.2' }, findings);
    expect(Object.keys(result.errors).sort()).toEqual(['mismatchMetered', 'mismatchReported']);
  });

  it('lists every empty field', () => {
    const result = checkReferral({}, findings);
    expect(Object.keys(result.errors).sort()).toEqual(
      ['mismatchDate', 'mismatchMetered', 'mismatchReported', 'surgeDate', 'surgeKwh']
    );
  });

  it('takes its answers from the detector, not from a fixed list', () => {
    // Different data, different right answer.
    const rows = [
      { date: '2026-01-01', meterReading: 0, reportedUsage: 10 },
      { date: '2026-01-02', meterReading: 10, reportedUsage: 10 },
      { date: '2026-01-03', meterReading: 21, reportedUsage: 11 },
      { date: '2026-01-04', meterReading: 31, reportedUsage: 10 },
      { date: '2026-01-05', meterReading: 931, reportedUsage: 900 },
      { date: '2026-01-06', meterReading: 942, reportedUsage: 99 },
      { date: '2026-01-07', meterReading: 952, reportedUsage: 10 },
    ];
    const other = analyseEnergy(rows);
    expect(checkReferral(correct, other).ok).toBe(false);
    expect(checkReferral({
      surgeDate: '2026-01-05', surgeKwh: '900',
      mismatchDate: '2026-01-06', mismatchReported: '99', mismatchMetered: '11',
    }, other)).toEqual({ ok: true });
  });
});

describe('unlocking the next stage', () => {
  it('a correct referral clears Energy Forensics and opens Signal Decoder', () => {
    let progress = createProgress();
    progress = completeStage(progress, 'intake');
    progress = completeStage(progress, 'files');
    expect(isUnlocked(progress, 'signal')).toBe(false);

    // This is what the forensics screen does when the form is accepted.
    if (checkReferral(correct, findings).ok) progress = completeStage(progress, 'forensics');
    expect(isUnlocked(progress, 'signal')).toBe(true);
  });

  it('a wrong referral leaves Signal Decoder sealed', () => {
    let progress = completeStage(completeStage(createProgress(), 'intake'), 'files');
    const wrong = { ...correct, surgeDate: '2026-10-18' };
    if (checkReferral(wrong, findings).ok) progress = completeStage(progress, 'forensics');
    expect(isUnlocked(progress, 'signal')).toBe(false);
  });
});
