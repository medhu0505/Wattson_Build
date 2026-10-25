// The store holds the one copy of the agent's progress while the site is open.
// Any part of the site can read it with store.get(), change it with
// store.update(), and ask to be told about changes with store.subscribe().
// Every change is saved to localStorage straight away.
//
// supervisor: true (from ?supervisor=1 in the address) uses a separate save,
// with every folder open, so the agent's own progress is never touched.

import {
  loadProgress, saveProgress, clearProgress, getBrowserStorage, createProgress,
  STORAGE_KEY, SUPERVISOR_KEY,
} from './progress.js';

export function createStore(storage = getBrowserStorage(), { supervisor = false } = {}) {
  const key = supervisor ? SUPERVISOR_KEY : STORAGE_KEY;

  // Make sure the progress matches the mode we're in. A supervisor gets a
  // name and a start time, so every screen (and the report) has them.
  function inMode(progress) {
    if (!supervisor) return { ...progress, supervisor: false };
    return {
      ...progress,
      supervisor: true,
      codename: progress.codename || 'Supervisor',
      startedAt: progress.startedAt ?? new Date().toISOString(),
    };
  }

  let progress = inMode(loadProgress(storage, key));
  const listeners = [];

  return {
    supervisor,

    get() {
      return progress;
    },

    // changeFn receives the current progress and returns the new one.
    update(changeFn) {
      progress = inMode(changeFn(progress));
      saveProgress(storage, progress, key);
      listeners.forEach((listener) => listener(progress));
    },

    // Start the case again from zero.
    reset() {
      clearProgress(storage, key);
      progress = inMode(createProgress());
      listeners.forEach((listener) => listener(progress));
    },

    subscribe(listener) {
      listeners.push(listener);
    },
  };
}
