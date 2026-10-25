// Tests for the unlock rules and for saving/loading progress.
// Run them with:  npm test

import { describe, it, expect } from 'vitest';
import {
  createProgress, isUnlocked, isCompleted, completeStage, currentStageId,
  stagesCleared, glitchLevel, loadProgress, saveProgress, clearProgress, cleanProgress,
  STORAGE_KEY, SUPERVISOR_KEY,
} from '../src/state/progress.js';
import { STAGE_IDS } from '../src/state/stages.js';
import { createStore } from '../src/state/store.js';

// A pretend localStorage that keeps things in memory.
function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

// A localStorage that refuses everything, like some private windows.
const brokenStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
};

// Clear every stage up to (and including) the given one, in order.
function clearUpTo(lastId) {
  let progress = createProgress();
  for (const id of STAGE_IDS) {
    progress = completeStage(progress, id);
    if (id === lastId) break;
  }
  return progress;
}

describe('starting state', () => {
  it('has nothing cleared, audio off and glitches on', () => {
    const progress = createProgress();
    expect(progress.completed).toEqual({});
    expect(progress.settings.audio).toBe(false);
    expect(progress.settings.glitch).toBe(true);
  });

  it('only the first stage is open', () => {
    const progress = createProgress();
    expect(isUnlocked(progress, 'intake')).toBe(true);
    for (const id of STAGE_IDS.slice(1)) {
      expect(isUnlocked(progress, id)).toBe(false);
    }
  });

  it('a stage that does not exist is never open', () => {
    expect(isUnlocked(createProgress(), 'secret-level')).toBe(false);
  });
});

describe('unlocking stages in order', () => {
  it('clearing a stage opens the next one, and only that one', () => {
    const progress = completeStage(createProgress(), 'intake');
    expect(isUnlocked(progress, 'files')).toBe(true);
    expect(isUnlocked(progress, 'forensics')).toBe(false);
  });

  it('a locked stage cannot be cleared', () => {
    const before = createProgress();
    const after = completeStage(before, 'signal');
    expect(isCompleted(after, 'signal')).toBe(false);
    expect(after).toBe(before); // nothing changed at all
  });

  it('does not change the old progress object', () => {
    const before = createProgress();
    completeStage(before, 'intake');
    expect(before.completed).toEqual({});
  });

  it('keeps the time of the first clear if a stage is cleared again', () => {
    const first = completeStage(createProgress(), 'intake', new Date('2026-10-23T22:31:00Z'));
    const again = completeStage(first, 'intake', new Date('2026-10-24T09:00:00Z'));
    expect(again.completed.intake).toBe('2026-10-23T22:31:00.000Z');
  });

  it('walks the whole case from intake to report', () => {
    let progress = createProgress();
    STAGE_IDS.forEach((id, index) => {
      expect(currentStageId(progress)).toBe(id);
      expect(stagesCleared(progress)).toBe(index);
      progress = completeStage(progress, id);
    });
    expect(stagesCleared(progress)).toBe(STAGE_IDS.length);
    // Everything cleared: the agent is left on the report.
    expect(currentStageId(progress)).toBe('report');
  });

  it('opens the report only after the machine terminal is cleared', () => {
    expect(isUnlocked(clearUpTo('signal'), 'report')).toBe(false);
    expect(isUnlocked(clearUpTo('machine'), 'report')).toBe(true);
  });
});

describe('glitch bleed level', () => {
  it('stays at 0 through intake and the case files', () => {
    expect(glitchLevel(createProgress())).toBe(0);
    expect(glitchLevel(clearUpTo('files'))).toBe(0);
  });

  it('rises by one for forensics, the decoder and the machine', () => {
    expect(glitchLevel(clearUpTo('forensics'))).toBe(1);
    expect(glitchLevel(clearUpTo('signal'))).toBe(2);
    expect(glitchLevel(clearUpTo('machine'))).toBe(3);
    expect(glitchLevel(clearUpTo('report'))).toBe(3);
  });
});

describe('saving and loading', () => {
  it('loads exactly what was saved', () => {
    const storage = fakeStorage();
    const progress = { ...clearUpTo('files'), codename: 'KESTREL' };
    expect(saveProgress(storage, progress)).toBe(true);
    expect(loadProgress(storage)).toEqual(progress);
  });

  it('starts fresh when nothing is saved', () => {
    expect(loadProgress(fakeStorage())).toEqual(createProgress());
  });

  it('starts fresh when there is no storage at all', () => {
    expect(loadProgress(null)).toEqual(createProgress());
    expect(saveProgress(null, createProgress())).toBe(false);
  });

  it('does not crash when the browser blocks storage', () => {
    expect(loadProgress(brokenStorage)).toEqual(createProgress());
    expect(saveProgress(brokenStorage, createProgress())).toBe(false);
    expect(clearProgress(brokenStorage)).toBe(false);
  });

  it('starts fresh when the saved text is not valid JSON', () => {
    const storage = fakeStorage();
    storage.setItem(STORAGE_KEY, '{ this is not json');
    expect(loadProgress(storage)).toEqual(createProgress());
  });

  it('clearProgress removes the save', () => {
    const storage = fakeStorage();
    saveProgress(storage, clearUpTo('intake'));
    clearProgress(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('cleaning saved data', () => {
  it('drops cleared stages that skip ahead of an uncleared one', () => {
    const tampered = {
      completed: { intake: '2026-10-25T00:00:00.000Z', forensics: '2026-10-25T00:00:00.000Z' },
    };
    const clean = cleanProgress(tampered);
    expect(Object.keys(clean.completed)).toEqual(['intake']);
    expect(isUnlocked(clean, 'signal')).toBe(false);
  });

  it('replaces values of the wrong type with safe defaults', () => {
    const clean = cleanProgress({
      codename: 42,
      pins: 'lots',
      answers: [],
      settings: { glitch: 'yes', audio: true },
    });
    expect(clean.codename).toBe('');
    expect(clean.pins).toEqual([]);
    expect(clean.answers).toEqual({});
    expect(clean.settings).toEqual({ glitch: true, audio: true });
  });

  it('keeps good pins and throws away broken ones', () => {
    const clean = cleanProgress({
      pins: [{ id: 'machine-id', x: 10, y: 20 }, { id: 'location' }, null, { id: 7, x: 1, y: 1 }],
    });
    expect(clean.pins).toEqual([{ id: 'machine-id', x: 10, y: 20 }]);
  });

  it('copes with saved data that is not an object', () => {
    expect(cleanProgress(null)).toEqual(createProgress());
    expect(cleanProgress('hello')).toEqual(createProgress());
  });
});

describe('supervisor mode (?supervisor=1)', () => {
  it('opens every stage, even with nothing cleared', () => {
    const progress = { ...createProgress(), supervisor: true };
    for (const id of STAGE_IDS) expect(isUnlocked(progress, id)).toBe(true);
    expect(isUnlocked(progress, 'secret-level')).toBe(false);
  });

  it('lets stages be cleared in any order', () => {
    const progress = completeStage({ ...createProgress(), supervisor: true }, 'signal');
    expect(isCompleted(progress, 'signal')).toBe(true);
    expect(isCompleted(progress, 'files')).toBe(false);
  });

  it('keeps out-of-order clears in a supervisor save, but not in an agent save', () => {
    const saved = { completed: { signal: '2026-10-25T10:00:00.000Z' } };
    expect(Object.keys(cleanProgress({ ...saved, supervisor: true }).completed)).toEqual(['signal']);
    expect(Object.keys(cleanProgress(saved).completed)).toEqual([]);
  });

  it('only counts supervisor: true exactly (not "yes" or 1)', () => {
    expect(cleanProgress({ supervisor: 'yes' }).supervisor).toBe(false);
    expect(cleanProgress({ supervisor: 1 }).supervisor).toBe(false);
  });

  it('saves separately, so the agent’s own progress is untouched', () => {
    const storage = fakeStorage();
    const agent = createStore(storage);
    agent.update((p) => completeStage({ ...p, codename: 'Kestrel' }, 'intake'));

    const judge = createStore(storage, { supervisor: true });
    judge.update((p) => completeStage(p, 'machine'));
    judge.reset();

    const agentAgain = createStore(storage);
    expect(agentAgain.get().codename).toBe('Kestrel');
    expect(Object.keys(agentAgain.get().completed)).toEqual(['intake']);
    expect(storage.getItem(SUPERVISOR_KEY)).toBeNull(); // the reset cleared only the supervisor save
  });

  it('gives the supervisor a name and start time, and never leaks the flag into an agent save', () => {
    const storage = fakeStorage();
    const judge = createStore(storage, { supervisor: true });
    expect(judge.get()).toMatchObject({ supervisor: true, codename: 'Supervisor' });
    expect(judge.get().startedAt).toEqual(expect.any(String));

    // Even if someone writes supervisor: true into the agent's save by hand...
    storage.setItem(STORAGE_KEY, JSON.stringify({ supervisor: true }));
    expect(createStore(storage).get().supervisor).toBe(false);
  });
});

describe('the store', () => {
  it('saves every change and tells listeners', () => {
    const storage = fakeStorage();
    const store = createStore(storage);
    const heard = [];
    store.subscribe((progress) => heard.push(progress.codename));

    store.update((progress) => ({ ...progress, codename: 'KESTREL' }));

    expect(store.get().codename).toBe('KESTREL');
    expect(JSON.parse(storage.getItem(STORAGE_KEY)).codename).toBe('KESTREL');
    expect(heard).toEqual(['KESTREL']);
  });

  it('picks up where the agent left off', () => {
    const storage = fakeStorage();
    saveProgress(storage, clearUpTo('files'));
    expect(currentStageId(createStore(storage).get())).toBe('forensics');
  });

  it('reset starts the case again', () => {
    const storage = fakeStorage();
    const store = createStore(storage);
    store.update((progress) => completeStage(progress, 'intake'));
    store.reset();
    expect(store.get()).toEqual(createProgress());
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('still works in memory when storage is blocked', () => {
    const store = createStore(brokenStorage);
    store.update((progress) => completeStage(progress, 'intake'));
    expect(isCompleted(store.get(), 'intake')).toBe(true);
  });
});
