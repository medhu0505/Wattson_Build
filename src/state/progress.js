// Everything about the agent's progress: what it looks like, which stages are
// unlocked, and saving/loading it in the browser (localStorage).
//
// The functions here never touch the web page, so the tests can run them
// directly. "storage" is anything with getItem/setItem, which in the browser
// is window.localStorage and in the tests is a small fake object.

import { STAGE_IDS } from './stages.js';

export const STORAGE_KEY = 'exun-case-1-progress';
// Supervisor mode (?supervisor=1) saves here instead, so a judge looking
// around never touches the agent's real progress.
export const SUPERVISOR_KEY = 'exun-case-1-supervisor';

// A brand-new agent with nothing done yet.
export function createProgress() {
  return {
    version: 1,
    supervisor: false, // true in supervisor mode: every folder is open
    codename: '',
    startedAt: null,   // when the agent signed in (ISO date text)
    completed: {},     // stage id -> when it was cleared, e.g. { intake: '2026-10-25T10:00:00.000Z' }
    pins: [],          // evidence board pins: [{ id, x, y }]
    answers: {},       // what the agent submitted at each stage
    hintsUsed: {},     // stage id -> how many hints they opened (0 to 3)
    settings: {
      glitch: true,    // glitch effects on (they also switch off for reduced motion)
      audio: false,    // audio is OFF until the agent turns it on
    },
  };
}

// ---------- Unlock rules ----------

// The first stage is always open. Every other stage opens once the stage
// before it has been cleared. In supervisor mode every stage is open.
export function isUnlocked(progress, stageId) {
  const index = STAGE_IDS.indexOf(stageId);
  if (index === -1) return false; // not a real stage
  if (progress.supervisor) return true;
  if (index === 0) return true;
  const previousId = STAGE_IDS[index - 1];
  return Boolean(progress.completed[previousId]);
}

export function isCompleted(progress, stageId) {
  return Boolean(progress.completed[stageId]);
}

// Mark a stage as cleared. Returns a NEW progress object (the old one is not
// changed). Locked stages can't be cleared, and clearing a stage twice keeps
// the time of the first clear.
export function completeStage(progress, stageId, now = new Date()) {
  if (!isUnlocked(progress, stageId)) return progress;
  if (isCompleted(progress, stageId)) return progress;
  return {
    ...progress,
    completed: { ...progress.completed, [stageId]: now.toISOString() },
  };
}

// The stage the agent should be working on: the first one not yet cleared.
// If everything is cleared, it's the last stage (the report).
export function currentStageId(progress) {
  const next = STAGE_IDS.find((id) => !isCompleted(progress, id));
  return next ?? STAGE_IDS[STAGE_IDS.length - 1];
}

// How many stages are cleared.
export function stagesCleared(progress) {
  return STAGE_IDS.filter((id) => isCompleted(progress, id)).length;
}

// How far the machine's glitches have "bled" into the agency's pages:
// 0 at the start, then one level for each of these stages cleared.
export const BLEED_STAGES = ['forensics', 'signal', 'machine'];
export function glitchLevel(progress) {
  return BLEED_STAGES.filter((id) => isCompleted(progress, id)).length;
}

// ---------- Saving and loading ----------

// Get the browser's localStorage, or null if the browser blocks it
// (some private windows throw an error just for asking).
export function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Read saved progress. Anything missing, broken or blocked falls back to a
// fresh start instead of crashing the site.
// key: which save to read (the agent's, or the supervisor's).
export function loadProgress(storage, key = STORAGE_KEY) {
  if (!storage) return createProgress();
  try {
    const text = storage.getItem(key);
    if (!text) return createProgress();
    return cleanProgress(JSON.parse(text));
  } catch {
    return createProgress();
  }
}

// Save progress. Returns true if it worked, false if the browser refused.
export function saveProgress(storage, progress, key = STORAGE_KEY) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

// Wipe saved progress (used by the "start over" button).
export function clearProgress(storage, key = STORAGE_KEY) {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// Saved data can be old, half-written or edited by hand. This rebuilds a
// safe progress object from it, keeping only values of the right type.
export function cleanProgress(saved) {
  const fresh = createProgress();
  if (!saved || typeof saved !== 'object') return fresh;

  const clean = {
    ...fresh,
    supervisor: saved.supervisor === true,
    codename: typeof saved.codename === 'string' ? saved.codename : '',
    startedAt: typeof saved.startedAt === 'string' ? saved.startedAt : null,
    pins: Array.isArray(saved.pins) ? saved.pins.filter(isValidPin) : [],
    answers: isPlainObject(saved.answers) ? saved.answers : {},
    hintsUsed: isPlainObject(saved.hintsUsed) ? saved.hintsUsed : {},
    settings: {
      glitch: typeof saved.settings?.glitch === 'boolean' ? saved.settings.glitch : fresh.settings.glitch,
      audio: typeof saved.settings?.audio === 'boolean' ? saved.settings.audio : fresh.settings.audio,
    },
  };

  // Keep cleared stages only while they form an unbroken chain from the
  // start. Someone who edits localStorage to mark stage 4 done without
  // stage 3 gets stopped at stage 3. (A supervisor can clear stages in any
  // order, so their save keeps every real stage.)
  const savedCompleted = isPlainObject(saved.completed) ? saved.completed : {};
  for (const id of STAGE_IDS) {
    if (typeof savedCompleted[id] === 'string') clean.completed[id] = savedCompleted[id];
    else if (!clean.supervisor) break;
  }

  return clean;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidPin(pin) {
  return isPlainObject(pin) && typeof pin.id === 'string'
    && Number.isFinite(pin.x) && Number.isFinite(pin.y);
}
