// Stage 04: Machine Terminal.
// The arcade cabinet's own screen. The agent types commands (or presses the
// cabinet's buttons) to investigate:
//   logs   – the cabinet's event log, cross-checked with the case files
//   diff   – the game's original code against the source code obtained on 24 October
//   render – the game world drawn from both versions of the code
// Once all three have been run, the screen breaks into the final reveal,
// which clears the stage and opens the case report.

import '../styles/machine.css';
import originalCode from '../../OriginalCode.txt?raw';
import alteredCode from '../../AlteredCode.txt?raw';
import canon from '../../content/canon.json';
import energy from '../../data/energy.json';
import { el, announce } from './dom.js';
import { storyLine } from './story.js';
import { artSlot } from './artSlot.js';
import { play, stop } from './audio.js';
import { prefersReducedMotion } from './effects.js';
import { diffLines, diffSummary, withContext } from '../lib/diff.js';
import { missingClasses, readGameSetup, renderWorld } from '../lib/arcade.js';
import { analyseEnergy } from '../lib/anomalies.js';
import { completeStage, isCompleted } from '../state/progress.js';
import { setOpenDocument } from './casefiles.js';

const COMMANDS = {
  help: 'list the commands',
  logs: 'read the cabinet’s event log',
  diff: `compare the game’s original code with the source code obtained ${canon.machine.sourceCodeObtained}`,
  render: 'draw the game world from both versions of the code',
  clear: 'clear the screen',
};

// The three checks that lead to the reveal, in the order the notes list them.
const CHECKS = [
  { command: 'logs', note: 'Read the cabinet’s event log' },
  { command: 'diff', note: 'Compare the original game code with the source code obtained later' },
  { command: 'render', note: 'Draw the game world from both versions' },
];

const LINE_DELAY = 45; // milliseconds between printed lines

// When the altered code was obtained, from Agent Nano's log: "24 OCTOBER".
const obtained = canon.machine.sourceCodeObtained.toUpperCase();

export function renderMachine(main, { store, go }) {
  const saved = () => store.get().answers.machine ?? { ran: {} };
  const hasRun = (command) => Boolean(saved().ran?.[command]);

  // ---------- The screen and its printer ----------

  const output = el('div', { class: 'crt__output', role: 'log', 'aria-label': 'Cabinet screen' });
  const screen = el('div', { class: 'crt' }, output);

  let queue = Promise.resolve(); // lines wait their turn here
  let closed = false;            // set when the agent leaves this screen

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Print lines one after another. Each item is text, a page element, or a
  // list of both (one line). instant = print it all at once.
  function print(items, { className = '', instant = false } = {}) {
    queue = queue.then(async () => {
      for (const item of items) {
        if (closed) return;
        output.append(item instanceof HTMLPreElement ? item : el('p', { class: `crt__line ${className}`.trim() }, item));
        output.scrollTop = output.scrollHeight;
        if (!instant && !prefersReducedMotion()) await wait(LINE_DELAY);
      }
    });
    return queue;
  }

  // A short burst of screen glitch (only visible when glitches are on).
  function burst() {
    screen.classList.remove('crt--burst');
    void screen.offsetWidth; // restart the animation if it's already running
    screen.classList.add('crt--burst');
    play('glitch-burst');
  }

  // ---------- Commands ----------

  function boot(instant) {
    // In supervisor mode the decoder may have been skipped, so there's no key.
    const key = store.get().answers.signal?.key ?? 'SUPERVISOR OVERRIDE';
    return print([
      el('span', { class: 'crt__title' }, canon.machine.name.toUpperCase()),
      `MACHINE ID ....... ${canon.machine.id}`,
      `LOCATION ......... ${canon.machine.location.toUpperCase()}`,
      `ACCESS KEY ....... ACCEPTED (${key})`,
      ' ',
      storyLine('machine.intro', {}, 'span'),
      ' ',
      'TYPE help OR PRESS A BUTTON BELOW THE SCREEN.',
    ], { instant });
  }

  function help() {
    return print([
      'COMMANDS',
      ...Object.entries(COMMANDS).map(([name, about]) => `  ${name.padEnd(8)} ${about}`),
    ]);
  }

  function logs(instant) {
    const analysis = analyseEnergy(energy.rows);
    const surge = analysis.surges[0];
    return print([
      'EVENT LOG',
      [storyLine('machine.twist1', {}, 'span')],
      [storyLine('machine.twist2', {}, 'span')],
      ' ',
      '--- CROSS-CHECK WITH EXUN CASE FILES ---',
      surge
        ? `DEPT. OF ELECTRICITY  ${surge.label.toUpperCase()}: METERED ${surge.metered.toLocaleString('en-GB')} kWh (TYPICAL DAY ${analysis.typical})`
        : 'DEPT. OF ELECTRICITY  NO SURGE ON RECORD',
      `TRANSCRIPT A          ${canon.pins['encounter-time'].label.toUpperCase()}`,
      `FIELD OBSERVATION     ${canon.pins.warbling.label.toUpperCase()}`,
    ], { instant, className: 'crt__line--log' });
  }

  function diff(instant) {
    const lines = diffLines(originalCode, alteredCode);
    const summary = diffSummary(lines);
    const missing = missingClasses(originalCode, alteredCode);

    // The diff itself, in one block: "-" lines removed, "+" lines added.
    const block = el('pre', { class: 'crt__diff' },
      withContext(lines, 2).map((line) => {
        if (line.type === 'skip') {
          return el('span', { class: 'diff-skip' }, `     ··· ${line.count} unchanged line${line.count === 1 ? '' : 's'} ···\n`);
        }
        const mark = { same: ' ', removed: '-', added: '+' }[line.type];
        const number = String(line.oldLine ?? line.newLine).padStart(3);
        return el('span', { class: `diff-${line.type}` }, `${mark} ${number}  ${line.text}\n`);
      }));

    return print([
      `COMPARING OriginalCode.txt WITH THE GAME SOURCE CODE OBTAINED ${obtained} (AlteredCode.txt)`,
      block,
      `${summary.removed} LINES REMOVED, ${summary.added} ADDED.`,
      ...missing.flatMap((c) => [
        el('span', { class: 'crt__warn' }, `CLASS ${c.name} (ORIGINAL LINE ${c.line}) IS MISSING FROM THE OBTAINED SOURCE CODE.`),
        el('span', { class: 'crt__warn' }, `THE OBTAINED CODE STILL USES ${c.name} ON LINE${c.stillUsedAt.length > 1 ? 'S' : ''} ${c.stillUsedAt.join(', ')}.`),
      ]),
      [storyLine('machine.diffComment', {}, 'span')],
    ], { instant });
  }

  function render(instant) {
    const setup = readGameSetup(originalCode);
    const missing = missingClasses(originalCode, alteredCode);
    const playerGone = missing.some((c) => c.name === 'Character');

    // Draw a world as text, with the player symbol picked out.
    const world = (player) => el('pre', { class: 'crt__world' },
      renderWorld(setup, player).map((row) => [
        ...row.split(setup.playerSymbol).flatMap((part, index, parts) =>
          index < parts.length - 1 ? [part, el('span', { class: 'crt__player' }, setup.playerSymbol)] : [part]),
        '\n',
      ]));

    return print([
      `ORIGINAL BUILD (OriginalCode.txt): ${setup.width} x ${setup.height} WORLD`,
      world(setup.start),
      `SOURCE CODE OBTAINED ${obtained} (AlteredCode.txt): ${setup.width} x ${setup.height} WORLD`,
      ...(playerGone
        ? [el('span', { class: 'crt__warn' }, `error: 'Character' does not name a type (lines ${missing[0].stillUsedAt.join(', ')})`)]
        : []),
      world(playerGone ? null : setup.start),
      el('span', { class: 'crt__warn' },
        `PLAYER ${setup.playerSymbol} EXPECTED AT (${setup.start.x}, ${setup.start.y}): ${playerGone ? 'NOT FOUND' : 'PRESENT'}`),
      [storyLine('machine.renderComment', {}, 'span')],
    ], { instant });
  }

  // The final reveal: the screen breaks up, then the hook for Case #2.
  function reveal(instant) {
    if (!instant) burst();
    print([' ', el('span', { class: 'crt__alert' }, '>>> SIGNAL INTERRUPT <<<')], { instant });
    print([[storyLine('machine.twist3', {}, 'span')]], { instant, className: 'crt__line--glitch' });
    queue = queue.then(() => (instant ? null : wait(700))).then(() => {
      if (!instant && !closed) { burst(); play('reveal-sting'); }
    });
    print([
      ' ',
      [storyLine('machine.case2Hook', {}, 'span')],
      ' ',
      el('span', { class: 'crt__alert' }, 'CASE #1: CLOSED     CASE #2: PENDING'),
    ], { instant, className: 'crt__line--glitch' });

    // Agent Nano's log arrives in the case files (it was sealed until now).
    const log = canon.documents.log;
    return print([
      ' ',
      el('span', { class: 'crt__warn' }, `NEW FILE IN FOLDER 01: ${log.title.toUpperCase()}`),
      el('span', { class: 'crt__warn' }, `FROM ${log.author.toUpperCase()}, WRITTEN ${log.written.toUpperCase()}`),
    ], { instant });
  }

  const ACTIONS = { logs, diff, render };

  // Run a command typed in (or pressed on the cabinet).
  function run(rawCommand) {
    const command = rawCommand.trim().toLowerCase();
    if (!command) return;
    print([`> ${command}`], { instant: true, className: 'crt__line--echo' });

    if (command === 'help') { help(); return; }
    if (command === 'clear') {
      queue = queue.then(() => output.replaceChildren());
      return;
    }
    if (!ACTIONS[command]) {
      print([`UNKNOWN COMMAND: ${command}. TYPE help.`]);
      return;
    }

    ACTIONS[command](false).then(() => {
      if (closed) return;
      if (!hasRun(command)) {
        store.update((p) => {
          const machine = p.answers.machine ?? { ran: {} };
          return { ...p, answers: { ...p.answers, machine: { ...machine, ran: { ...machine.ran, [command]: true } } } };
        });
        drawNotes();
      }
      maybeReveal();
    });
  }

  // When every check has been run (and the reveal hasn't been seen yet), reveal.
  // This goes by "revealed", not by the stage being cleared, so a supervisor
  // who marked every folder cleared still gets to see the reveal.
  function maybeReveal() {
    if (saved().revealed || !CHECKS.every((check) => hasRun(check.command))) return;
    reveal(false).then(() => {
      if (closed) return;
      store.update((p) => completeStage({
        ...p, answers: { ...p.answers, machine: { ...(p.answers.machine ?? {}), revealed: true } },
      }, 'machine'));
      drawNotes();
      announce('The machine has revealed what happened. Folder 05, Case Report, is now open.');
    });
  }

  // ---------- Prompt and cabinet buttons ----------

  const input = el('input', {
    id: 'crt-input', class: 'crt__input', type: 'text',
    autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off',
  });
  const prompt = el('form', { class: 'crt__prompt' },
    el('label', { for: 'crt-input', class: 'visually-hidden' }, 'Command'),
    el('span', { class: 'crt__caret', 'aria-hidden': 'true' }, '>'),
    input);
  prompt.addEventListener('submit', (event) => {
    event.preventDefault();
    run(input.value);
    input.value = '';
  });
  screen.append(prompt);

  // Clicking anywhere on the screen puts the cursor in the prompt.
  screen.addEventListener('click', (event) => {
    if (!event.target.closest('button') && !window.getSelection()?.toString()) input.focus({ preventScroll: true });
  });

  const deck = el('div', { class: 'cabinet__deck', role: 'group', 'aria-label': 'Cabinet buttons' },
    ['logs', 'diff', 'render', 'help', 'clear'].map((command) =>
      el('button', { class: `arcade-btn arcade-btn--${command}`, type: 'button', onClick: () => run(command) },
        el('span', { class: 'arcade-btn__cap', 'aria-hidden': 'true' }),
        el('span', { class: 'arcade-btn__label' }, command))));

  // ---------- Field notes (agency paper beside the cabinet) ----------

  const notes = el('aside', { class: 'notes', 'aria-labelledby': 'notes-title' });

  function drawNotes() {
    const progress = store.get();
    const done = isCompleted(progress, 'machine');
    // filter(Boolean) drops the "false" entries: unlike el(), replaceChildren
    // would print them as the word "false".
    notes.replaceChildren(...[
      el('p', { class: 'sheet__ref' }, 'Field notes'),
      el('h2', { id: 'notes-title', class: 'notes__title' }, 'What to check'),
      el('ol', { class: 'notes__list' },
        CHECKS.map((check) => el('li', { class: hasRun(check.command) ? 'is-done' : null },
          el('span', { class: 'notes__box', 'aria-hidden': 'true' }, hasRun(check.command) ? 'x' : ''),
          el('span', {}, check.note, ' ', el('code', {}, check.command)),
          el('span', { class: 'visually-hidden' }, hasRun(check.command) ? ' (done)' : ' (not done yet)')))),
      done && el('p', { class: 'stamp notes__stamp', 'aria-hidden': 'true' }, 'Case #2 pending'),
      done && el('button', {
        class: 'btn btn--ghost notes__log', type: 'button',
        onClick: () => { setOpenDocument('log'); go('files'); },
      }, 'Read Agent Nano’s log'),
      done && el('button', { class: 'btn', type: 'button', onClick: () => go('report') }, 'Open folder 05: Case Report'),
    ].filter(Boolean));
  }

  // ---------- Put it all together ----------

  const marqueeText = el('p', { class: 'marquee-text' }, canon.machine.name);

  main.append(
    el('div', { class: 'machine' },
      el('h1', { class: 'visually-hidden' }, `Machine Terminal: ${canon.machine.name}`),
      el('div', { class: 'cabinet' },
        artSlot('marquee', { fallback: marqueeText, className: 'cabinet__marquee' }),
        el('div', { class: 'cabinet__bezel' }, screen),
        deck),
      notes));

  drawNotes();
  play('crt-hum');

  // Coming back to this screen: show what was already found, without
  // animation. A first visit boots up line by line.
  const returning = CHECKS.some((check) => hasRun(check.command));
  boot(returning);
  if (returning) {
    CHECKS.filter((check) => hasRun(check.command)).forEach((check) => {
      print([`> ${check.command}`], { instant: true, className: 'crt__line--echo' });
      ACTIONS[check.command](true);
    });
    if (saved().revealed) reveal(true);
    else maybeReveal();
  }
  queue.then(() => { if (!closed) input.focus({ preventScroll: true }); });

  // When the agent leaves: stop printing and stop the hum.
  return () => {
    closed = true;
    stop('crt-hum');
  };
}
