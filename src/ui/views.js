// Which screen draws each stage. Each milestone swaps a stand-in for the real one.

import { pendingView } from './pending.js';
import { renderIntake } from './intake.js';
import { renderCaseFiles } from './casefiles.js';
import { renderForensics } from './forensics.js';
import { renderSignal } from './signal.js';
import { renderMachine } from './terminal.js';

export const views = {
  intake: renderIntake,
  files: renderCaseFiles,
  forensics: renderForensics,
  signal: renderSignal,
  machine: renderMachine,
  report: pendingView('M6'),
};
