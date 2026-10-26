// Builds the case report from the agent's real progress: what they pinned,
// what they filed, what they decoded, what they found in the machine.
// buildReport() gathers the facts; reportToText() turns them into the
// plain-text file the agent can download. No web page code in here.

import { STAGES } from '../state/stages.js';
import { isCompleted } from '../state/progress.js';
import { agentNumber } from './codename.js';
import { analyseEnergy } from './anomalies.js';
import { keyProgress } from './evidence.js';
import { expectedKey } from './machineKey.js';
import { diffLines, diffSummary } from './diff.js';
import { missingClasses, readGameSetup } from './arcade.js';
import { hintsUsed } from './hints.js';

// 3,900,000 ms -> "1 h 05 min"
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'under a minute';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest} min` : `${hours} h ${String(rest).padStart(2, '0')} min`;
}

// '2026-10-25T10:05:00.000Z' -> '25 Oct 2026, 10:05' (in the agent's own time zone)
export function formatDateTime(isoText) {
  const date = new Date(isoText ?? NaN);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const kwh = (value) => value.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// progress: the agent's saved progress
// sources:  { canon, energy, originalCode, alteredCode } (the case material)
export function buildReport(progress, { canon, energy, originalCode, alteredCode }, now = new Date()) {
  const codename = progress.codename || 'Unassigned';
  const started = progress.startedAt ? new Date(progress.startedAt) : null;
  const sinceStart = (isoText) => (started && isoText ? formatDuration(new Date(isoText) - started) : null);

  // When each stage was cleared
  const timeline = STAGES.map((stage) => ({
    tab: stage.tab,
    title: stage.title,
    clearedAt: progress.completed[stage.id] ?? null,
    afterStart: sinceStart(progress.completed[stage.id]),
  }));

  // The evidence board, in the order things were pinned
  const pins = progress.pins
    .filter((pin) => canon.pins[pin.id])
    .map((pin) => {
      const info = canon.pins[pin.id];
      return { label: info.label, source: canon.documents[info.doc].title, key: info.key };
    });

  // The energy analysis is worked out again from the data, so it always matches.
  const analysis = analyseEnergy(energy.rows);
  const machineRan = progress.answers.machine?.ran ?? {};

  // The code comparison
  const lines = diffLines(originalCode, alteredCode);
  const removedLines = lines.filter((line) => line.type === 'removed').map((line) => line.oldLine);

  return {
    caseName: 'Case #1, Wenoti Arcade',
    site: canon.machine.location,
    agent: { codename, number: agentNumber(codename) },
    startedAt: progress.startedAt,
    generatedAt: now.toISOString(),
    supervisor: Boolean(progress.supervisor), // true: made in supervisor mode, not an agent's own run
    closed: isCompleted(progress, 'machine'),
    timeline,
    totalTime: sinceStart(progress.completed.machine),

    evidence: {
      done: isCompleted(progress, 'files'),
      ...keyProgress(progress.pins, canon.pins),
      pins,
    },

    forensics: {
      done: isCompleted(progress, 'forensics'),
      surges: analysis.surges.map((day) => ({ label: day.label, metered: day.metered })),
      mismatches: analysis.mismatches.map((day) => ({
        label: day.label, reported: day.reportedUsage, metered: day.metered, gap: day.gap,
      })),
      totals: analysis.totals,
      referral: progress.answers.forensics?.referral ?? null,
    },

    signal: {
      done: isCompleted(progress, 'signal'),
      machineId: canon.machine.id,
      decodesTo: expectedKey(canon.machine.id),
      keyEntered: progress.answers.signal?.key ?? null,
    },

    machine: {
      done: isCompleted(progress, 'machine'),
      checksRun: ['logs', 'diff', 'render'].filter((check) => machineRan[check]),
      ...diffSummary(lines),
      removedFrom: removedLines[0] ?? null,
      removedTo: removedLines.at(-1) ?? null,
      missing: missingClasses(originalCode, alteredCode),
      setup: readGameSetup(originalCode),
    },

    // What happened when, from the case files themselves (canon.json "timeline").
    caseTimeline: canon.timeline.map((event) => ({
      when: event.when, what: event.what, source: canon.documents[event.source].title,
    })),

    // Agent Nano's log, which reaches the same finding as the agent.
    nanoLog: {
      title: canon.documents.log.title,
      author: canon.documents.log.author,
      written: canon.documents.log.written,
      concern: canon.documents.log.concern,
      question: canon.documents.log.question,
    },

    hints: STAGES.map((stage) => ({ title: stage.title, used: hintsUsed(progress, stage.id) })),
  };
}

// Turn a date value ('2026-10-23') from the referral into its dossier label ('Oct 23').
function dateLabel(energy, date) {
  return energy.rows.find((row) => row.date === date)?.label ?? '—';
}

// The plain-text version, for downloading.
// closing: the team's closing statement (from content/story.json)
// team:    who made the site (content/team.json), printed as the last line
export function reportToText(report, { energy, closing = '', team = null }) {
  const out = [];
  const line = (text = '') => out.push(text);
  const heading = (text) => { line(); line(text.toUpperCase()); line('-'.repeat(text.length)); };
  const notDone = () => line('  Not completed.');

  line('EXUN · EXTRADIGITAL EXCEPTIONS AND UNKNOWNS NETWORK');
  line(`CASE REPORT · ${report.caseName.toUpperCase()}`);
  line('='.repeat(56));
  line(`STATUS: ${report.closed ? 'CASE #1 CLOSED; CASE #2 PENDING' : 'INVESTIGATION IN PROGRESS'}`);
  if (report.supervisor) line('MODE:   SUPERVISOR OVERRIDE (folders opened by a supervisor, not cleared in order)');
  line();
  line('To:      Extradigital Exceptions and Unknowns Network');
  line(`From:    Agent ${report.agent.codename} (${report.agent.number})`);
  line(`Re:      Case #1, ${report.site}`);
  line(`Opened:  ${formatDateTime(report.startedAt)}`);
  line(`Report:  ${formatDateTime(report.generatedAt)}`);

  heading('1. Timeline');
  for (const stage of report.timeline) {
    const when = stage.clearedAt
      ? `cleared ${formatDateTime(stage.clearedAt)}${stage.afterStart ? ` (+${stage.afterStart})` : ''}`
      : 'not cleared';
    line(`  ${stage.tab} ${stage.title.padEnd(18)} ${when}`);
  }
  if (report.totalTime) line(`  Time to close the case: ${report.totalTime}`);

  heading('2. Evidence filed (case files)');
  line(`  Key details on the board: ${report.evidence.found} of ${report.evidence.total}`);
  if (report.evidence.pins.length === 0) line('  Nothing pinned.');
  for (const pin of report.evidence.pins) {
    line(`  * ${pin.label} [${pin.source}]${pin.key ? ' (key detail)' : ''}`);
  }
  if (!report.evidence.done) notDone();

  heading('3. Energy forensics');
  if (!report.forensics.done) {
    notDone();
  } else {
    for (const day of report.forensics.surges) line(`  Surge: ${day.label}, ${kwh(day.metered)} kWh metered.`);
    for (const day of report.forensics.mismatches) {
      line(`  Mismatch: ${day.label}, ${kwh(day.reported)} kWh reported but ${kwh(day.metered)} kWh metered (gap ${day.gap > 0 ? '+' : ''}${kwh(day.gap)}).`);
    }
    const { totals } = report.forensics;
    line(`  Totals over checkable days: ${kwh(totals.reported)} kWh reported, ${kwh(totals.metered)} kWh metered.`);
    const sent = report.forensics.referral;
    if (sent) {
      line('  Referral filed with the Department of Electricity:');
      line(`    Surge: ${dateLabel(energy, sent.surgeDate)}, ${sent.surgeKwh} kWh`);
      line(`    Mismatch: ${dateLabel(energy, sent.mismatchDate)}, reported ${sent.mismatchReported}, metered ${sent.mismatchMetered}`);
      line('    Status: RECEIVED');
    }
  }

  heading('4. Signal analysis');
  if (!report.signal.done) {
    notDone();
  } else {
    line(`  Machine ID ${report.signal.machineId} decodes (Base32) to: ${report.signal.decodesTo}`);
    line(report.signal.keyEntered
      ? `  Access key entered: ${report.signal.keyEntered}. ACCESS GRANTED.`
      : '  Access key entered: not recorded.');
  }

  heading('5. Machine examination');
  if (!report.machine.done) {
    notDone();
  } else {
    const m = report.machine;
    line(`  Checks run: ${m.checksRun.length ? m.checksRun.join(', ') : 'none recorded'}`);
    line(`  Code comparison: ${m.removed} lines removed, ${m.added} added (original lines ${m.removedFrom}–${m.removedTo}).`);
    for (const c of m.missing) {
      line(`  Class ${c.name} (original line ${c.line}) is gone; the code still uses it on lines ${c.stillUsedAt.join(', ')}.`);
    }
    if (m.setup) {
      line(`  World render: player ${m.setup.playerSymbol} expected at (${m.setup.start.x}, ${m.setup.start.y}): not found.`);
    }
  }

  heading('6. Case timeline');
  if (report.closed) {
    for (const event of report.caseTimeline) {
      line(`  ${event.when.padEnd(18)} ${event.what} [${event.source}]`);
    }
  } else {
    notDone();
  }

  heading('7. Conclusion');
  if (report.closed) {
    const log = report.nanoLog;
    line(`  ${closing}`);
    line(`  ${log.author}'s ${log.title} (${log.written}) reaches the same finding: "${log.concern}".`);
    line(`  Case #2: pending. Open question from ${log.author}: ${log.question}`);
  } else {
    notDone();
  }

  heading('8. Assistance');
  const usedHints = report.hints.filter((stage) => stage.used > 0);
  const total = report.hints.reduce((sum, stage) => sum + stage.used, 0);
  line(`  Hints used: ${total}`);
  for (const stage of usedHints) line(`    ${stage.title}: ${stage.used}`);

  line();
  line(`Signed: Agent ${report.agent.codename}`);

  // Who made the case terminal (content/team.json), as a last line.
  if (team) {
    const names = team.members.length > 1
      ? `${team.members.slice(0, -1).join(', ')} and ${team.members.at(-1)}`
      : team.members.join('');
    line();
    line(`EXUN Case Terminal, made by Team ${team.team}: ${names}.`);
  }
  return `${out.join('\n')}\n`;
}

// A safe file name: "exun-case-1-report-night-owl.txt"
export function reportFileName(codename) {
  const slug = String(codename || 'agent').toLowerCase().normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'agent';
  return `exun-case-1-report-${slug}.txt`;
}
