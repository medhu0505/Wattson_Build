// Stage 02: Energy Forensics.
// Left: the Department's records as a table and a chart. The agent runs the
//       analysis, which works out the meter differences and flags anomalies.
// Right: the Discrepancy Referral form. Filling it in correctly (checked
//        against the analysis) clears the stage.

import '../styles/forensics.css';
import energy from '../../data/energy.json';
import canon from '../../content/canon.json';
import { el, announce } from './dom.js';
import { storyLine } from './story.js';
import { renderDocument } from './document.js';
import { renderEnergyChart } from './energyChart.js';
import { analyseEnergy, SURGE_SCORE, MISMATCH_TOLERANCE } from '../lib/anomalies.js';
import { checkReferral } from '../lib/referral.js';
import { completeStage, isCompleted } from '../state/progress.js';

const kwh = (value, digits = 1) =>
  value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Labels for the detector's flags.
const FLAG_TEXT = { surge: 'Surge', mismatch: 'Mismatch', unverified: 'No prior reading' };

// The form's fields, in order.
const FIELDS = [
  { name: 'surgeDate', label: 'Date of the demand surge', type: 'date' },
  { name: 'surgeKwh', label: 'Size of the surge, from the meter (kWh)', type: 'number' },
  { name: 'mismatchDate', label: 'Date where the reported usage disagrees with the meter', type: 'date' },
  { name: 'mismatchReported', label: 'Usage reported for that date (kWh)', type: 'number' },
  { name: 'mismatchMetered', label: 'Usage the meter recorded for that date (kWh)', type: 'number' },
];

export function renderForensics(main, { store, go }) {
  // The analysis is worked out from data/energy.json every time; nothing is stored.
  const analysis = analyseEnergy(energy.rows);
  let scale = 'linear';

  const saved = () => store.get().answers.forensics ?? {};
  const isAnalysed = () => Boolean(saved().analysed);

  // ---------- Records table ----------

  const tableWrap = el('div', { class: 'records-wrap', tabindex: '0', 'aria-label': 'Consumption records table' });

  function drawTable() {
    const analysed = isAnalysed();
    const head = ['Day', 'Date (2026)', 'Meter reading (kWh)', 'Daily usage, reported (kWh)'];
    if (analysed) head.push('Metered usage (kWh)', 'Reported minus metered (kWh)', 'Flag');

    const rows = analysis.days.map((day) => {
      const flagged = day.flags.includes('surge') || day.flags.includes('mismatch');
      const cells = [
        el('td', {}, day.day),
        el('td', {}, day.label),
        el('td', { class: 'num' }, kwh(day.meterReading, 2)),
        el('td', { class: 'num' }, kwh(day.reportedUsage)),
      ];
      if (analysed) {
        cells.push(
          el('td', { class: 'num' }, day.metered === null ? '—' : kwh(day.metered)),
          el('td', { class: `num${day.flags.includes('mismatch') ? ' num--bad' : ''}` },
            day.gap === null ? '—' : `${day.gap > 0 ? '+' : ''}${kwh(day.gap)}`),
          el('td', {}, day.flags.map((flag) =>
            el('span', { class: `flag flag--${flag}` }, FLAG_TEXT[flag])))
        );
      }
      const classes = [day.highlighted && 'row--highlight', analysed && flagged && 'row--flagged'].filter(Boolean);
      return el('tr', { class: classes.join(' ') || null }, cells);
    });

    tableWrap.replaceChildren(
      el('table', { class: 'records' },
        el('caption', {}, 'Copied from the Energy Usage Dossier. Days 13 and 14 are highlighted in the original.'),
        el('thead', {}, el('tr', {}, head.map((text) => el('th', { scope: 'col' }, text)))),
        el('tbody', {}, rows)
      )
    );
  }

  // ---------- Chart ----------

  // Focusable, so keyboard users can scroll it sideways on narrow screens.
  const chartWrap = el('div', { class: 'chart-wrap', tabindex: '0', role: 'region', 'aria-label': 'Energy chart' });
  const scaleButtons = ['linear', 'log'].map((name) =>
    el('button', {
      class: 'scale-btn',
      type: 'button',
      'aria-pressed': String(name === scale),
      onClick: () => { scale = name; drawChart(); },
    }, name === 'linear' ? 'Linear' : 'Logarithmic'));

  function drawChart(reveal = false) {
    scaleButtons.forEach((button, index) =>
      button.setAttribute('aria-pressed', String(['linear', 'log'][index] === scale)));
    chartWrap.replaceChildren(renderEnergyChart(analysis, { analysed: isAnalysed(), scale, reveal }));
    // On a phone the chart is wider than the screen and scrolls sideways.
    // Start at the right-hand end, where the last days of the record are.
    requestAnimationFrame(() => { chartWrap.scrollLeft = chartWrap.scrollWidth; });
  }

  // ---------- Running the analysis, and what it found ----------

  const analysisPanel = el('div', { class: 'analysis' });

  function drawAnalysisPanel() {
    if (!isAnalysed()) {
      analysisPanel.replaceChildren(
        el('p', {}, 'The dossier gives a meter reading and a reported usage for each day. The analysis works out what the meter actually recorded each day (today’s reading minus yesterday’s) and checks it against the report.'),
        el('button', { class: 'btn', type: 'button', onClick: runAnalysis }, 'Run forensic analysis')
      );
      return;
    }

    const findings = [
      ...analysis.surges.map((day) => el('li', {},
        el('span', { class: 'flag flag--surge' }, 'Surge'),
        ` ${day.label}: the meter recorded ${kwh(day.metered)} kWh, against a typical day of ${kwh(analysis.typical)} kWh. Unusualness score ${kwh(day.score)} (flagged above ${SURGE_SCORE}).`)),
      ...analysis.mismatches.map((day) => el('li', {},
        el('span', { class: 'flag flag--mismatch' }, 'Mismatch'),
        ` ${day.label}: ${kwh(day.reportedUsage)} kWh reported, but the meter readings show ${kwh(day.metered)} kWh. A gap of ${day.gap > 0 ? '+' : ''}${kwh(day.gap)} kWh.`)),
      ...analysis.unverified.map((day) => el('li', {},
        el('span', { class: 'flag flag--unverified' }, 'No prior reading'),
        ` ${day.label}: the first row has no earlier reading, so its usage can’t be checked.`)),
    ];

    analysisPanel.replaceChildren(
      el('h3', { class: 'analysis__title' }, `Findings: ${analysis.surges.length + analysis.mismatches.length} anomalies flagged`),
      el('ul', { class: 'analysis__list' }, findings),
      el('p', { class: 'analysis__totals' },
        `Across the days that can be checked, the reported usage adds up to ${kwh(analysis.totals.reported)} kWh; the meter recorded ${kwh(analysis.totals.metered)} kWh. Difference: ${analysis.totals.difference > 0 ? '+' : ''}${kwh(analysis.totals.difference)} kWh.`),
      el('details', { class: 'analysis__method' },
        el('summary', {}, 'How the analysis decides'),
        el('p', {}, `Metered usage is each day’s meter reading minus the day before. A typical day is the median metered usage (${kwh(analysis.typical)} kWh), and the typical spread is the median distance from it (${kwh(analysis.spread)} kWh). Each day’s score is how many spreads it sits above typical (a “modified z-score”). Above ${SURGE_SCORE} is a surge. Because medians are used, the surge itself can’t hide by dragging the average up.`),
        el('p', {}, `A mismatch is any day where the reported and metered usage differ by more than ${MISMATCH_TOLERANCE} kWh.`))
    );
  }

  function runAnalysis() {
    store.update((progress) => ({
      ...progress,
      answers: { ...progress.answers, forensics: { ...saved(), analysed: true } },
    }));
    drawTable();
    drawChart(true);
    drawAnalysisPanel();
    analysisPanel.querySelector('h3').setAttribute('tabindex', '-1');
    analysisPanel.querySelector('h3').focus();
    announce(`Analysis complete. ${analysis.surges.length} surge and ${analysis.mismatches.length} mismatch flagged.`);
  }

  // ---------- Referral form ----------

  const referral = el('section', { class: 'referral', 'aria-labelledby': 'referral-title' });

  function drawReferral() {
    const progress = store.get();
    const header = [
      el('p', { class: 'referral__perforation', 'aria-hidden': 'true' }),
      el('p', { class: 'sheet__ref' }, 'Form / Discrepancy referral'),
      el('h2', { id: 'referral-title', class: 'referral__title' }, 'Discrepancy Referral'),
      el('dl', { class: 'form-fixed' },
        el('dt', {}, 'To'), el('dd', {}, 'Department of Electricity, Government of nuxEland'),
        el('dt', {}, 'From'), el('dd', {}, `Agent ${progress.codename || 'unassigned'}, EXUN`),
        el('dt', {}, 'Re'), el('dd', {}, 'Wenoti Arcade, 92nd Avenue')),
    ];

    if (isCompleted(progress, 'forensics')) {
      const sent = saved().referral ?? {};
      referral.replaceChildren(...header,
        el('p', { class: 'stamp referral__stamp', 'aria-hidden': 'true' }, 'Received'),
        el('dl', { class: 'referral__sent' },
          FIELDS.map((field) => [
            el('dt', {}, field.label),
            el('dd', {}, field.type === 'date' ? dateLabel(sent[field.name]) : (sent[field.name] ?? '—')),
          ])),
        storyLine('forensics.outro', { codename: progress.codename }, 'p'),
        el('button', { class: 'btn', type: 'button', onClick: () => go('signal') }, 'Open folder 03: Signal Decoder'));
      return;
    }

    const controls = {};
    const errorBoxes = {};
    const fieldRows = FIELDS.map((field) => {
      const id = `ref-${field.name}`;
      const errorId = `${id}-error`;
      const control = field.type === 'date'
        ? el('select', { id, name: field.name, 'aria-describedby': errorId },
          el('option', { value: '' }, 'Choose a date'),
          analysis.days.map((day) => el('option', { value: day.date }, day.label)))
        : el('input', { id, name: field.name, type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-describedby': errorId });
      controls[field.name] = control;
      errorBoxes[field.name] = el('p', { id: errorId, class: 'field-error' });
      return el('div', { class: 'field' },
        el('label', { for: id, class: 'field__label' }, field.label), control, errorBoxes[field.name]);
    });

    const form = el('form', { class: 'referral__form', novalidate: true },
      el('fieldset', {}, el('legend', {}, 'The surge'), fieldRows.slice(0, 2)),
      el('fieldset', {}, el('legend', {}, 'The mismatch'), fieldRows.slice(2)),
      el('button', { class: 'btn', type: 'submit' }, 'Refer to the Department'));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(FIELDS.map((field) => [field.name, controls[field.name].value]));
      const result = checkReferral(values, analysis);

      for (const field of FIELDS) {
        const message = result.errors?.[field.name] ?? '';
        errorBoxes[field.name].textContent = message;
        if (message) controls[field.name].setAttribute('aria-invalid', 'true');
        else controls[field.name].removeAttribute('aria-invalid');
      }

      if (!result.ok) {
        const firstBad = FIELDS.find((field) => result.errors[field.name]);
        controls[firstBad.name].focus();
        announce(`The referral was returned: ${Object.keys(result.errors).length} field(s) need correcting.`);
        return;
      }

      store.update((progress) => completeStage({
        ...progress,
        answers: { ...progress.answers, forensics: { ...saved(), referral: values } },
      }, 'forensics'));
      drawReferral();
      announce('Referral received by the Department. Folder 03, Signal Decoder, is now open.');
      referral.querySelector('button').focus();
    });

    referral.replaceChildren(...header,
      el('p', { class: 'referral__note' }, 'Per the Department’s request, refer any relevant discrepancy found in the records.'),
      form);
  }

  // ---------- Put it all together ----------

  const memo = el('details', { class: 'dossier-memo' },
    el('summary', {}, 'Covering memo from the Department of Electricity'),
    renderDocument(canon.documents.dossier, { progress: store.get() }));

  main.append(
    el('div', { class: 'forensics' },
      el('section', { class: 'sheet forensics__sheet' },
        el('p', { class: 'sheet__ref' }, 'Folder 02 / Energy forensics'),
        el('h1', { class: 'sheet__title' }, 'Energy Forensics'),
        storyLine('forensics.intro', { codename: store.get().codename }, 'p'),
        memo,
        el('h2', { class: 'forensics__subhead' }, 'Consumption records, Wenoti Arcade'),
        tableWrap,
        analysisPanel,
        el('figure', { class: 'chart-figure' },
          el('div', { class: 'chart-figure__bar' },
            el('div', { class: 'chart-legend', 'aria-hidden': 'true' },
              el('span', { class: 'chart-legend__reported' }, 'Reported usage'),
              el('span', { class: 'chart-legend__metered' }, 'Metered usage')),
            el('div', { class: 'scale-toggle', role: 'group', 'aria-label': 'Chart scale' }, scaleButtons)),
          chartWrap,
          el('figcaption', {}, 'Linear shows the size of the surge; logarithmic spreads small and large values out so every day stays readable.'))
      ),
      referral
    )
  );

  drawTable();
  drawChart();
  drawAnalysisPanel();
  drawReferral();
}

// '2026-10-23' -> 'Oct 23' (using the dossier's own labels)
function dateLabel(date) {
  return energy.rows.find((row) => row.date === date)?.label ?? '—';
}
