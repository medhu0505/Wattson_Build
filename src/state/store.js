// The store holds the one copy of the agent's progress while the site is open.
// Any part of the site can read it with store.get(), change it with
// store.update(), and ask to be told about changes with store.subscribe().
// Every change is saved to localStorage straight away.

import { loadProgress, saveProgress, clearProgress, getBrowserStorage, createProgress } from './progress.js';

export function createStore(storage = getBrowserStorage()) {
  let progress = loadProgress(storage);
  const listeners = [];

  return {
    get() {
      return progress;
    },

    // changeFn receives the current progress and returns the new one.
    update(changeFn) {
      progress = changeFn(progress);
      saveProgress(storage, progress);
      listeners.forEach((listener) => listener(progress));
    },

    // Start the case again from zero.
    reset() {
      clearProgress(storage);
      progress = createProgress();
      listeners.forEach((listener) => listener(progress));
    },

    subscribe(listener) {
      listeners.push(listener);
    },
  };
}
