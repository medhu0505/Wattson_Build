// Stage 03: Signal Decoder.
// Left: a decoding worksheet. Pick a method (or auto-detect), paste a
//       signal, and the readout updates as you type.
// Right: the cabinet access card. Entering the decoded Machine ID clears
//        the stage and opens the Machine Terminal.

import '../styles/signal.css';
import canon from '../../content/canon.json';
import { el, announce } from './dom.js';
import { storyLine } from './story.js';
import { TOOLS, autoDetect, caesarAll } from '../lib/decoders.js';
import { checkAccessKey } from '../lib/machineKey.js';
import { completeStage, isCompleted } from '../state/progress.js';

// The method buttons, in order. 'auto' is auto-detect.
const METHODS = [
  { id: 'auto', label: 'Auto-detect' },
  ...Object.entries(TOOLS).map(([id, tool]) => ({ id, label: tool.label })),
];

// The worksheet remembers its settings while the site stays open.
const worksheet = { method: 'auto', direction: 'decode', shift: 3, input: '' };

export function renderSignal(main, { store, go }) {
  const machine = canon.machine;

  // ---------- Controls ----------

  // A group of radio buttons that look like tabs.
  function radioGroup(name, legend, options, selected, className) {
    return el('fieldset', { class: className },
      el('legend', {}, legend),
      el('div', { class: 'methods__list' },
        options.map((option) => el('label', { class: `method method--${option.id}` },
          el('input', { type: 'radio', name, value: option.id, checked: option.id === selected }),
          el('span', {}, option.label)))));
  }

  const methodField = radioGroup('method', 'Method', METHODS, worksheet.method, 'methods');
  const directionField = radioGroup('direction', 'Direction',
    [{ id: 'decode', label: 'Decode' }, { id: 'encode', label: 'Encode' }], worksheet.direction, 'direction');

  const shiftInput = el('input', { id: 'caesar-shift', type: 'number', min: '1', max: '25', value: String(worksheet.shift) });
  const shiftField = el('div', { class: 'shift' },
    el('label', { for: 'caesar-shift', class: 'signal-label' }, 'Shift'), shiftInput);

  const input = el('textarea', {
    id: 'signal-input', rows: '3', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off',
  });
  input.value = worksheet.input;

  methodField.addEventListener('change', (event) => {
    worksheet.method = event.target.value;
    drawOptions();
    drawReadout();
  });
  directionField.addEventListener('change', (event) => {
    worksheet.direction = event.target.value;
    drawReadout();
  });
  shiftInput.addEventListener('input', () => {
    const shift = Number(shiftInput.value);
    worksheet.shift = Number.isFinite(shift) ? shift : 0;
    drawReadout();
  });
  input.addEventListener('input', () => {
    worksheet.input = input.value;
    drawReadout();
  });

  // Direction makes no sense for auto-detect or reverse; shift is Caesar only.
  function drawOptions() {
    directionField.hidden = worksheet.method === 'auto' || worksheet.method === 'reverse';
    shiftField.hidden = worksheet.method !== 'caesar';
  }

  // Put some text into the signal box (used by the "use as input" buttons).
  function setInput(text, message) {
    input.value = text;
    worksheet.input = text;
    drawReadout();
    input.focus();
    if (message) announce(message);
  }

  // ---------- Readout ----------

  const readout = el('div', { class: 'readout', id: 'readout' });
  let announceTimer = null;

  function drawReadout() {
    const text = worksheet.input;
    let summary = '';

    if (!text.trim()) {
      readout.replaceChildren(tape('Readout', el('p', { class: 'tape__text tape__text--empty' }, 'Type or paste a signal above.')));
    } else if (worksheet.method === 'auto') {
      const guesses = autoDetect(text);
      if (guesses.length === 0) {
        readout.replaceChildren(tape('Auto-detect',
          el('p', { class: 'tape__error' }, 'Nothing readable came out. Try a method by hand.')));
        summary = 'Auto-detect found nothing readable.';
      } else {
        readout.replaceChildren(tape('Auto-detect: most readable first',
          el('ol', { class: 'guesses' }, guesses.map((guess, index) => guessRow(guess, index)))));
        summary = `Best guess, ${guesses[0].label}: ${guesses[0].output}`;
      }
    } else {
      const tool = TOOLS[worksheet.method];
      const result = tool[worksheet.direction](text, { shift: worksheet.shift });
      // e.g. "Base32 decode", "Caesar encode, shift 13", or just "Reverse"
      let heading = worksheet.method === 'reverse' ? tool.label : `${tool.label} ${worksheet.direction}`;
      if (worksheet.method === 'caesar') heading += `, shift ${worksheet.shift}`;
      readout.replaceChildren(
        tape(heading, result.ok
          ? el('p', { class: 'tape__text' }, result.output)
          : el('p', { class: 'tape__error' }, result.error)),
        result.ok && actions(result.output),
        worksheet.method === 'caesar' && allShifts(text)
      );
      summary = result.ok ? `${heading}: ${result.output}` : result.error;
    }

    // Read the result out to screen-reader users once typing pauses,
    // rather than after every key.
    clearTimeout(announceTimer);
    if (summary) announceTimer = setTimeout(() => announce(summary), 700);
  }

  function tape(label, ...content) {
    return el('div', { class: 'tape' }, el('p', { class: 'tape__label' }, label), content);
  }

  // index 0 is the best guess.
  function guessRow(guess, index) {
    const isBest = index === 0;
    return el('li', { class: `guess${isBest ? ' guess--best' : ''}` },
      el('span', { class: 'guess__rank' }, isBest ? 'BEST' : `#${index + 1}`),
      el('span', {},
        el('span', { class: 'guess__method' }, guess.label),
        el('span', { class: 'guess__output' }, guess.output)),
      el('span', { class: 'guess__side' },
        el('span', { class: 'score', style: `--score: ${guess.score}`, title: `Readability ${guess.score}` },
          el('span', { class: 'score__fill' }),
          el('span', { class: 'visually-hidden' }, `Readability ${Math.round(guess.score * 100)} out of 100`)),
        el('button', {
          class: 'link-btn', type: 'button',
          onClick: () => setInput(guess.output, 'Result moved into the signal box.'),
        }, 'Use as input')));
  }

  function actions(output) {
    return el('div', { class: 'readout__actions' },
      el('button', { class: 'link-btn', type: 'button', onClick: () => setInput(output, 'Result moved into the signal box.') }, 'Use as input'),
      el('button', { class: 'link-btn', type: 'button', onClick: () => copy(output) }, 'Copy'));
  }

  // Every Caesar shift at once, for working by eye.
  function allShifts(text) {
    return el('details', { class: 'all-shifts' },
      el('summary', {}, 'Show all 25 shifts'),
      el('ol', {}, caesarAll(text).map((attempt) =>
        el('li', {}, el('b', {}, `back ${attempt.back}`), attempt.output))));
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      announce('Copied.');
    } catch {
      announce('Copying is blocked in this browser. Select the text and copy it instead.');
    }
  }

  // ---------- Cabinet access card ----------

  const access = el('section', { class: 'access', 'aria-labelledby': 'access-title' });

  function drawAccess() {
    const progress = store.get();
    const header = [
      el('h2', { id: 'access-title', class: 'access__title' }, 'Cabinet access'),
      el('dl', { class: 'form-fixed' },
        el('dt', {}, 'Machine'), el('dd', {}, machine.name),
        el('dt', {}, 'Location'), el('dd', {}, machine.location),
        el('dt', {}, 'Machine ID'), el('dd', { class: 'access__id' }, machine.id)),
    ];

    if (isCompleted(progress, 'signal')) {
      access.replaceChildren(...header,
        el('p', { class: 'stamp access__stamp', 'aria-hidden': 'true' }, 'Access granted'),
        el('p', { class: 'access__key' }, 'Key accepted: ', el('b', {}, progress.answers.signal?.key ?? '')),
        storyLine('signal.outro', { codename: progress.codename }, 'p'),
        el('button', { class: 'btn', type: 'button', onClick: () => go('machine') }, 'Open folder 04: Machine Terminal'));
      return;
    }

    const keyInput = el('input', {
      id: 'access-key', type: 'text', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off',
      'aria-describedby': 'access-key-error',
    });
    const error = el('p', { id: 'access-key-error', class: 'field-error' });

    const form = el('form', { novalidate: true },
      el('div', { class: 'field' },
        el('label', { for: 'access-key', class: 'field__label' }, 'Access key (decoded)'), keyInput, error),
      el('button', { class: 'btn', type: 'submit' }, 'Request access'));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = checkAccessKey(keyInput.value, machine.id);
      if (!result.ok) {
        error.textContent = result.error;
        keyInput.setAttribute('aria-invalid', 'true');
        keyInput.focus();
        return;
      }
      store.update((p) => completeStage({ ...p, answers: { ...p.answers, signal: { key: result.key } } }, 'signal'));
      drawAccess();
      announce('Access granted. Folder 04, Machine Terminal, is now open.');
      access.querySelector('.btn').focus();
    });

    access.replaceChildren(...header,
      el('button', {
        class: 'link-btn', type: 'button',
        onClick: () => setInput(machine.id, 'Machine ID loaded into the signal box.'),
      }, 'Load the Machine ID into the worksheet'),
      form);
  }

  // ---------- Put it all together ----------

  main.append(
    el('div', { class: 'signal' },
      el('section', { class: 'sheet signal__sheet' },
        el('p', { class: 'sheet__ref' }, 'Folder 03 / Signal decoder'),
        el('h1', { class: 'sheet__title' }, 'Signal Decoder'),
        storyLine('signal.intro', { codename: store.get().codename }, 'p'),
        methodField,
        el('div', { class: 'signal-options' }, directionField, shiftField),
        el('div', { class: 'signal-input-wrap' },
          el('div', { class: 'signal-input-row' },
            el('label', { for: 'signal-input', class: 'signal-label' }, 'Signal'),
            el('button', { class: 'link-btn', type: 'button', onClick: () => setInput('', 'Signal box cleared.') }, 'Clear')),
          input),
        readout),
      access));

  drawOptions();
  drawReadout();
  drawAccess();
}
