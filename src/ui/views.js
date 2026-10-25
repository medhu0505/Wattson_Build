// Which screen draws each stage. Each milestone swaps a stand-in for the real one.

import { pendingView } from './pending.js';

export const views = {
  intake: pendingView('M1'),
  files: pendingView('M2'),
  forensics: pendingView('M3'),
  signal: pendingView('M4'),
  machine: pendingView('M5'),
  report: pendingView('M6'),
};
