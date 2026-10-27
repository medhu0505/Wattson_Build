// Tests for the end of Case #1: the Suspension Notice, acknowledging it, and
// the agent's answer to Agent Nano's question.

import { describe, it, expect } from 'vitest';
import { epilogueState, isSuspended, acknowledgeNotice, chooseNext, CHOICES } from '../src/lib/epilogue.js';
import { createProgress, completeStage, cleanProgress } from '../src/state/progress.js';
import { STAGE_IDS } from '../src/state/stages.js';

const NOW = new Date('2026-10-27T09:00:00.000Z');

// Every folder cleared except, optionally, the report.
function agent({ filed }) {
  let progress = { ...createProgress(), codename: 'Kestrel' };
  for (const id of STAGE_IDS) {
    if (id === 'report' && !filed) break;
    progress = completeStage(progress, id);
  }
  return progress;
}

describe('before the report is filed', () => {
  const progress = agent({ filed: false });

  it('nothing has arrived', () => {
    expect(epilogueState(progress)).toEqual({ arrived: false, acknowledgedAt: null, choice: null });
    expect(isSuspended(progress)).toBe(false);
  });

  it('the notice can’t be acknowledged yet', () => {
    expect(acknowledgeNotice(progress, NOW)).toBe(progress);
  });
});

describe('after the report is filed', () => {
  const filed = agent({ filed: true });

  it('the notice arrives, waiting to be acknowledged', () => {
    expect(epilogueState(filed)).toEqual({ arrived: true, acknowledgedAt: null, choice: null });
  });

  it('no choice can be made before acknowledging', () => {
    expect(chooseNext(filed, 'continue')).toBe(filed);
  });

  it('acknowledging suspends EXUN and records when', () => {
    const acknowledged = acknowledgeNotice(filed, NOW);
    expect(isSuspended(acknowledged)).toBe(true);
    expect(epilogueState(acknowledged).acknowledgedAt).toBe(NOW.toISOString());
    expect(isSuspended(filed)).toBe(false); // the old progress is left alone
  });

  it('acknowledging twice keeps the first time', () => {
    const once = acknowledgeNotice(filed, NOW);
    expect(acknowledgeNotice(once, new Date('2026-10-28T00:00:00.000Z'))).toBe(once);
  });

  it('each answer to Nano’s question is recorded, and is final', () => {
    const acknowledged = acknowledgeNotice(filed, NOW);
    for (const choice of CHOICES) {
      const chosen = chooseNext(acknowledged, choice);
      expect(epilogueState(chosen).choice).toBe(choice);
      expect(chooseNext(chosen, CHOICES.find((other) => other !== choice))).toBe(chosen);
    }
  });

  it('ignores an answer that isn’t one of the choices', () => {
    const acknowledged = acknowledgeNotice(filed, NOW);
    expect(chooseNext(acknowledged, 'run away')).toBe(acknowledged);
  });
});

describe('saved data that has been tampered with', () => {
  it('a choice without an acknowledgement doesn’t count', () => {
    const progress = { ...agent({ filed: true }), answers: { epilogue: { choice: 'continue' } } };
    expect(epilogueState(progress)).toEqual({ arrived: true, acknowledgedAt: null, choice: null });
  });

  it('an acknowledgement before the report is filed doesn’t count', () => {
    const progress = { ...agent({ filed: false }), answers: { epilogue: { acknowledgedAt: NOW.toISOString(), choice: 'comply' } } };
    expect(isSuspended(progress)).toBe(false);
  });

  it('survives being saved and loaded', () => {
    const chosen = chooseNext(acknowledgeNotice(agent({ filed: true }), NOW), 'comply');
    const reloaded = cleanProgress(JSON.parse(JSON.stringify(chosen)));
    expect(epilogueState(reloaded)).toEqual({ arrived: true, acknowledgedAt: NOW.toISOString(), choice: 'comply' });
  });

  it('copes with a save that has no answers at all', () => {
    expect(epilogueState({ ...agent({ filed: true }), answers: undefined }).arrived).toBe(true);
  });
});
