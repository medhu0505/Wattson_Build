// Stage 05: Case Report.
// The report is written from the agent's real progress (src/lib/report.js).
// The agent can print it (or save it as a PDF from the print window) or
// download a plain-text copy. Doing either files the report, and then the
// end of the case arrives above it in the in tray (src/ui/epilogue.js).

import '../styles/report.css';
import canon from '../../content/canon.json';
import energy from '../../data/energy.json';
import story from '../../content/story.json';
import team from '../../content/team.json';
import { memberList } from './colophon.js';
import originalCode from '../../case-files/OriginalCode.txt?raw';
import alteredCode from '../../case-files/AlteredCode.txt?raw';
import { el, announce } from './dom.js';
import { storyLine } from './story.js';
import { buildReport, reportToText, formatDateTime, reportFileName, suspensionLine } from '../lib/report.js';
import { createEpilogue } from './epilogue.js';
import { completeStage, isCompleted } from '../state/progress.js';

const kwh = (value) => value.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const SOURCES = { canon, energy, originalCode, alteredCode };

export function renderReport(main, { store }) {
  // ---------- Filing (print / download) ----------

  const dispatch = el('aside', { class: 'dispatch', 'aria-labelledby': 'dispatch-title' });

  function fileReport() {
    if (isCompleted(store.get(), 'report')) return;
    store.update((p) => completeStage({
      ...p, answers: { ...p.answers, report: { filedAt: new Date().toISOString() } },
    }, 'report'));
    drawDispatch();
  }

  function printReport() {
    const firstTime = !isCompleted(store.get(), 'report');
    fileReport();
    window.print(); // the browser's print window; "Save as PDF" is one of its options
    if (firstTime) afterFiling(); // after printing, so the printout doesn't mention what comes next
  }

  function downloadReport() {
    const text = reportToText(buildReport(store.get(), SOURCES), { energy, closing: story.report.closing, team });
    // Make a file in memory and "click" a link to it.
    const file = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = el('a', { href: url, download: reportFileName(store.get().codename) });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // tidy up the in-memory file
    const firstTime = !isCompleted(store.get(), 'report');
    fileReport();
    announce('Report downloaded.');
    if (firstTime) afterFiling();
  }

  // Filing opens the Suspension Notice, which adds a date to the case
  // timeline: redraw the report, then bring in the notice.
  function afterFiling() {
    drawSheet();
    epilogue.arrive();
  }

  function drawDispatch() {
    const filed = store.get().answers.report?.filedAt;
    dispatch.replaceChildren(...[
      el('p', { class: 'sheet__ref' }, 'Out tray'),
      el('h2', { id: 'dispatch-title', class: 'dispatch__title' }, 'File this report'),
      el('p', {}, 'Print it (or choose “Save as PDF” in the print window), or download a plain-text copy.'),
      el('div', { class: 'dispatch__buttons' },
        el('button', { class: 'btn', type: 'button', onClick: printReport }, 'Print / save as PDF'),
        el('button', { class: 'btn btn--ghost', type: 'button', onClick: downloadReport }, 'Download (.txt)')),
      filed && el('p', { class: 'stamp stamp--blue dispatch__stamp', 'aria-hidden': 'true' }, 'Filed'),
      filed && el('p', { class: 'dispatch__note' }, `Filed ${formatDateTime(filed)}.`),
    ].filter(Boolean));
  }

  // ---------- The report itself ----------
  // Built by a function so it can be redrawn when the ending moves on.

  function buildSheet() {
    const report = buildReport(store.get(), SOURCES);
    const notDone = () => el('p', { class: 'report__pending' }, 'Not completed.');

    const section = (number, title, ...content) =>
      el('section', { class: 'report__section' },
        el('h2', { class: 'report__heading' }, `${number}. ${title}`), content);

    const timeline = section(1, 'Timeline',
      el('table', { class: 'report__table' },
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col' }, 'Folder'), el('th', { scope: 'col' }, 'Cleared'), el('th', { scope: 'col' }, 'After'))),
        el('tbody', {}, report.timeline.map((stage) => el('tr', {},
          el('td', {}, `${stage.tab} ${stage.title}`),
          el('td', {}, stage.clearedAt ? formatDateTime(stage.clearedAt) : 'not cleared'),
          el('td', {}, stage.afterStart ? `+${stage.afterStart}` : '—'))))),
      report.totalTime && el('p', {}, `Time to close the case: ${report.totalTime}.`));

    const evidence = section(2, 'Evidence filed',
      el('p', {}, `Key details on the board: ${report.evidence.found} of ${report.evidence.total}.`),
      report.evidence.pins.length === 0
        ? el('p', {}, 'Nothing pinned.')
        : el('ul', { class: 'report__list' }, report.evidence.pins.map((pin) =>
          el('li', {}, pin.label, el('span', { class: 'report__source' }, ` [${pin.source}]`),
            pin.key && el('span', { class: 'report__key' }, ' key detail')))),
      !report.evidence.done && notDone());

    const f = report.forensics;
    const sent = f.referral;
    const label = (date) => energy.rows.find((row) => row.date === date)?.label ?? '—';
    const forensics = section(3, 'Energy forensics',
      f.done ? [
        el('ul', { class: 'report__list' },
          f.surges.map((day) => el('li', {}, `Surge: ${day.label}, ${kwh(day.metered)} kWh metered.`)),
          f.mismatches.map((day) => el('li', {},
            `Mismatch: ${day.label}, ${kwh(day.reported)} kWh reported but ${kwh(day.metered)} kWh metered (gap ${day.gap > 0 ? '+' : ''}${kwh(day.gap)}).`)),
          el('li', {}, `Totals over checkable days: ${kwh(f.totals.reported)} kWh reported, ${kwh(f.totals.metered)} kWh metered.`)),
        sent && el('div', { class: 'doc-box report__referral' },
          el('p', {}, el('strong', {}, 'Referral to the Department of Electricity: RECEIVED')),
          el('p', {}, `Surge: ${label(sent.surgeDate)}, ${sent.surgeKwh} kWh`),
          el('p', {}, `Mismatch: ${label(sent.mismatchDate)}, reported ${sent.mismatchReported}, metered ${sent.mismatchMetered}`)),
      ] : notDone());

    const signal = section(4, 'Signal analysis',
      report.signal.done ? [
        el('p', {}, 'Machine ID ', el('strong', {}, report.signal.machineId), ' decodes (Base32) to ', el('strong', {}, report.signal.decodesTo), '.'),
        el('p', {}, report.signal.keyEntered
          ? `Access key entered: ${report.signal.keyEntered}. Access granted.`
          : 'Access key entered: not recorded.'),
      ] : notDone());

    const m = report.machine;
    const machine = section(5, 'Machine examination',
      m.done ? [
        el('p', {}, `Checks run: ${m.checksRun.length ? m.checksRun.join(', ') : 'none recorded'}.`),
        el('p', {}, `Code comparison: ${m.removed} lines removed, ${m.added} added (original lines ${m.removedFrom}–${m.removedTo}).`),
        m.missing.map((c) => el('p', {},
          `Class ${c.name} (original line ${c.line}) is gone; the code still uses it on lines ${c.stillUsedAt.join(', ')}.`)),
        m.setup && el('p', {},
          `World render: player ${m.setup.playerSymbol} expected at (${m.setup.start.x}, ${m.setup.start.y}): not found.`),
      ] : notDone());

    // What happened when, from the case files (shown once the case is closed,
    // because it includes what Agent Nano's log revealed).
    const caseTimeline = section(6, 'Case timeline',
      report.closed
        ? el('table', { class: 'report__table' },
          el('thead', {}, el('tr', {},
            el('th', { scope: 'col' }, 'When'), el('th', { scope: 'col' }, 'What'), el('th', { scope: 'col' }, 'Source'))),
          el('tbody', {}, report.caseTimeline.map((event) => el('tr', {},
            el('td', {}, event.when), el('td', {}, event.what), el('td', {}, event.source)))))
        : notDone());

    const log = report.nanoLog;
    const conclusion = section(7, 'Conclusion',
      report.closed
        ? [
          storyLine('report.closing', { codename: report.agent.codename }, 'p'),
          el('p', {}, `${log.author}’s ${log.title} (${log.written}) reaches the same finding: “${log.concern}”.`),
          el('p', {}, 'Case #2: pending. Open question from ', log.author, ': ',
            el('span', { class: 'hand report__why' }, log.question)),
          report.suspension && el('p', { class: 'report__suspension' }, suspensionLine(report.suspension)),
        ]
        : notDone());

    const totalHints = report.hints.reduce((sum, stage) => sum + stage.used, 0);
    const assistance = section(8, 'Assistance',
      el('p', {}, `Hints used: ${totalHints}.`),
      totalHints > 0 && el('ul', { class: 'report__list' },
        report.hints.filter((stage) => stage.used > 0).map((stage) => el('li', {}, `${stage.title}: ${stage.used}`))));

    return el('article', { class: 'sheet report', 'aria-labelledby': 'report-title' },
      el('header', { class: 'doc__header' },
        el('span', { class: 'mark mark--small', 'aria-hidden': 'true' },
          el('span', { class: 'mark__word' }, 'EXUN'), el('span', { class: 'mark__year' }, '2026')),
        el('h1', { id: 'report-title', class: 'doc__title' }, 'Case Report')),
      el('p', { class: `stamp report__stamp${report.closed ? '' : ' stamp--blue'}`, 'aria-hidden': 'true' },
        report.closed ? 'Case closed' : 'In progress'),
      report.supervisor && el('p', { class: 'stamp report__override', 'aria-hidden': 'true' }, 'Supervisor override'),
      el('div', { class: 'doc-box' },
        el('p', {}, el('strong', {}, `STATUS: ${report.status}`)),
        report.supervisor && el('p', {}, el('strong', {}, 'MODE: SUPERVISOR OVERRIDE (folders opened by a supervisor, not cleared in order)')),
        el('p', {}, ' '),
        el('p', {}, 'To: Extradigital Exceptions and Unknowns Network'),
        el('p', {}, `From: Agent ${report.agent.codename} (${report.agent.number})`),
        el('p', {}, `Re: Case #1, ${report.site}`),
        el('p', {}, `Opened: ${formatDateTime(report.startedAt)}   ·   Report: ${formatDateTime(report.generatedAt)}`)),
      timeline, evidence, forensics, signal, machine, caseTimeline, conclusion, assistance,
      el('p', { class: 'report__signature' }, 'Signed: ', el('span', {}, `Agent ${report.agent.codename}`)),
      el('p', { class: 'report__colophon' }, `EXUN Case Terminal, made by Team ${team.team}: ${memberList()}.`));
  }

  let sheet = buildSheet();
  function drawSheet() {
    const fresh = buildSheet();
    sheet.replaceWith(fresh);
    sheet = fresh;
  }

  // The ending sits above the report once it's filed (empty until then).
  const epilogue = createEpilogue({ store, onChange: drawSheet });

  main.append(epilogue.element, el('div', { class: 'report-desk' }, sheet, dispatch));
  drawDispatch();
}
