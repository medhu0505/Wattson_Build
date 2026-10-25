// Which screen draws each stage. Each milestone swaps a stand-in for the real one.

import { pendingView } from './pending.js';
import { renderIntake } from './intake.js';

export const views = {
  intake: renderIntake,
  files: pendingView('M2'),
  forensics: pendingView('M3'),
  signal: pendingView('M4'),
  machine: pendingView('M5'),
  report: pendingView('M6'),
};
