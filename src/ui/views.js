// Which screen draws each stage. Each milestone swaps a stand-in for the real one.

import { pendingView } from './pending.js';
import { renderIntake } from './intake.js';
import { renderCaseFiles } from './casefiles.js';
import { renderForensics } from './forensics.js';

export const views = {
  intake: renderIntake,
  files: renderCaseFiles,
  forensics: renderForensics,
  signal: pendingView('M4'),
  machine: pendingView('M5'),
  report: pendingView('M6'),
};
