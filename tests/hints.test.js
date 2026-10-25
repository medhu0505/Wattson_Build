// Tests for the hints: three per stage, opened one at a time, filled in
// from the data.

import { describe, it, expect } from 'vitest';
import { hintsUsed, revealNextHint, hintValues, hintsFor, HINTS_PER_STAGE } from '../src/lib/hints.js';
import { createProgress } from '../src/state/progress.js';
import { STAGE_IDS } from '../src/state/stages.js';
import hints from '../content/hints.json';
import canon from '../content/canon.json';
import energy from '../data/energy.json';

const values = hintValues({ canon, energy });

describe('hints.json', () => {
  it('has exactly three non-empty hints for every stage', () => {
    for (const id of STAGE_IDS) {
      expect(hints[id]).toHaveLength(HINTS_PER_STAGE);
      for (const hint of hints[id]) expect(hint.trim().length).toBeGreaterThan(10);
    }
  });

  it('fills in every {word}, leaving none behind', () => {
    for (const id of STAGE_IDS) {
      for (const hint of hintsFor(id, hints, values)) expect(hint).not.toMatch(/\{\w+\}/);
    }
  });

  it('gets the figures from the data, not from typing them in', () => {
    const forensics = hintsFor('forensics', hints, values)[2];
    expect(forensics).toContain('Oct 23, 2,684 kWh');
    expect(forensics).toContain('Oct 24, reported 503.2 kWh, metered 30.7 kWh');
    expect(hintsFor('signal', hints, values)[2]).toContain('MJWHKZLTNBUXE5A to blueshirt');
    expect(hintsFor('files', hints, values)[2]).toContain(canon.pins['machine-id'].label);
  });
});

describe('opening hints', () => {
  it('starts with none opened', () => {
    expect(hintsUsed(createProgress(), 'files')).toBe(0);
  });

  it('opens them one at a time, and stops at three', () => {
    let progress = createProgress();
    for (let i = 1; i <= 5; i += 1) progress = revealNextHint(progress, 'files');
    expect(hintsUsed(progress, 'files')).toBe(3);
  });

  it('counts each stage separately', () => {
    const progress = revealNextHint(revealNextHint(createProgress(), 'signal'), 'files');
    expect(hintsUsed(progress, 'signal')).toBe(1);
    expect(hintsUsed(progress, 'files')).toBe(1);
    expect(hintsUsed(progress, 'machine')).toBe(0);
  });

  it('does not change the old progress', () => {
    const before = createProgress();
    revealNextHint(before, 'files');
    expect(before.hintsUsed).toEqual({});
  });

  it('copes with a broken saved count', () => {
    expect(hintsUsed({ hintsUsed: { files: 'lots' } }, 'files')).toBe(0);
    expect(hintsUsed({ hintsUsed: { files: 99 } }, 'files')).toBe(3);
    expect(hintsUsed({ hintsUsed: { files: -2 } }, 'files')).toBe(0);
    expect(hintsUsed({}, 'files')).toBe(0);
  });
});
