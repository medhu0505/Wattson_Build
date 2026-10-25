// Tests for the cabinet access key, which unlocks the Machine Terminal.

import { describe, it, expect } from 'vitest';
import { checkAccessKey, expectedKey } from '../src/lib/machineKey.js';
import { completeStage, createProgress, isUnlocked } from '../src/state/progress.js';
import { STAGE_IDS } from '../src/state/stages.js';
import canon from '../content/canon.json';

const machineId = canon.machine.id;

describe('the Machine ID', () => {
  it('in canon.json matches the one printed in the Case Debrief', () => {
    const debriefText = JSON.stringify(canon.documents.debrief);
    expect(debriefText).toContain(`"MJWHKZLTNBUXE5A"`);
    expect(machineId).toBe('MJWHKZLTNBUXE5A');
  });

  it('decodes to "blueshirt"', () => {
    expect(expectedKey(machineId)).toBe('blueshirt');
  });
});

describe('checking the access key', () => {
  it('accepts the decoded key, ignoring capitals and outer spaces', () => {
    expect(checkAccessKey('blueshirt', machineId)).toEqual({ ok: true, key: 'blueshirt' });
    expect(checkAccessKey('  BlueShirt ', machineId).ok).toBe(true);
  });

  it('tells the agent when they have typed the Machine ID itself', () => {
    expect(checkAccessKey('MJWHKZLTNBUXE5A', machineId).error).toMatch(/needs decoding/);
  });

  it('rejects wrong keys and empty input', () => {
    expect(checkAccessKey('blue shirt', machineId).ok).toBe(false);
    expect(checkAccessKey('redshirt', machineId).error).toMatch(/rejects/);
    expect(checkAccessKey('', machineId).error).toMatch(/Enter/);
    expect(checkAccessKey(undefined, machineId).ok).toBe(false);
  });

  it('rejects everything if the Machine ID itself is broken', () => {
    expect(checkAccessKey('blueshirt', 'NOT*BASE32').ok).toBe(false);
  });
});

describe('unlocking the next stage', () => {
  // Progress with every stage before the decoder cleared.
  function readyForDecoder() {
    let progress = createProgress();
    for (const id of STAGE_IDS.slice(0, STAGE_IDS.indexOf('signal'))) progress = completeStage(progress, id);
    return progress;
  }

  it('the right key clears Signal Decoder and opens the Machine Terminal', () => {
    let progress = readyForDecoder();
    expect(isUnlocked(progress, 'machine')).toBe(false);
    if (checkAccessKey('blueshirt', machineId).ok) progress = completeStage(progress, 'signal');
    expect(isUnlocked(progress, 'machine')).toBe(true);
  });

  it('a wrong key leaves the Machine Terminal sealed', () => {
    let progress = readyForDecoder();
    if (checkAccessKey('MJWHKZLTNBUXE5A', machineId).ok) progress = completeStage(progress, 'signal');
    expect(isUnlocked(progress, 'machine')).toBe(false);
  });
});
