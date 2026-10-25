// Which screen draws each stage.

import { renderIntake } from './intake.js';
import { renderCaseFiles } from './casefiles.js';
import { renderForensics } from './forensics.js';
import { renderSignal } from './signal.js';
import { renderMachine } from './terminal.js';
import { renderReport } from './report.js';

export const views = {
  intake: renderIntake,
  files: renderCaseFiles,
  forensics: renderForensics,
  signal: renderSignal,
  machine: renderMachine,
  report: renderReport,
};
