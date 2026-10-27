// The end of Case #1, after the report is filed:
//   1. the Suspension Notice arrives in the in tray,
//   2. the agent acknowledges receipt (the notice tells them to),
//   3. Agent Nano's note slips out from behind it,
//   4. the note asks "What are you going to do now?" and the agent chooses.
// No web page code in here, so the tests can check it directly.
//
// Saved in progress.answers.epilogue as { acknowledgedAt, choice }.

import { isCompleted } from '../state/progress.js';

// What the agent can do when Nano asks what's next.
export const CHOICES = ['comply', 'continue'];

// Where the agent is in the ending. Saved data is checked step by step, so a
// hand-edited save can't skip ahead (a choice without an acknowledgement, say).
export function epilogueState(progress) {
  const saved = progress.answers?.epilogue ?? {};
  const arrived = isCompleted(progress, 'report');
  const acknowledgedAt = arrived && typeof saved.acknowledgedAt === 'string' ? saved.acknowledgedAt : null;
  const choice = acknowledgedAt && CHOICES.includes(saved.choice) ? saved.choice : null;
  return { arrived, acknowledgedAt, choice };
}

// True once the agent has acknowledged the notice: EXUN is suspended.
export function isSuspended(progress) {
  return Boolean(epilogueState(progress).acknowledgedAt);
}

// Each function below returns a NEW progress object and leaves the old one alone.
// Asking for a step that isn't open yet (or is already done) changes nothing.

export function acknowledgeNotice(progress, now = new Date()) {
  const state = epilogueState(progress);
  if (!state.arrived || state.acknowledgedAt) return progress;
  return {
    ...progress,
    answers: { ...progress.answers, epilogue: { acknowledgedAt: now.toISOString(), choice: null } },
  };
}

// The choice is final: once made, it can't be changed.
export function chooseNext(progress, choice) {
  const state = epilogueState(progress);
  if (!state.acknowledgedAt || state.choice || !CHOICES.includes(choice)) return progress;
  return {
    ...progress,
    answers: { ...progress.answers, epilogue: { acknowledgedAt: state.acknowledgedAt, choice } },
  };
}
