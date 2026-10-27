// The end of Case #1, on the Case Report screen once the report is filed:
// the Suspension Notice in the in tray, the "Acknowledge receipt" button,
// Agent Nano's note sliding out from behind it, and the agent's answer to
// Nano's question. The rules for each step are in src/lib/epilogue.js.

import '../styles/epilogue.css';
import canon from '../../content/canon.json';
import { el, announce } from './dom.js';
import { storyLine } from './story.js';
import { renderDocument } from './document.js';
import { prefersReducedMotion } from './effects.js';
import { epilogueState, acknowledgeNotice, chooseNext } from '../lib/epilogue.js';
import { formatDateTime } from '../lib/report.js';

const notice = canon.documents.suspension;
const note = canon.documents.note;

// The stamp under the agent's answer.
const OUTCOME_STAMP = { comply: 'Case #2: pending', continue: 'Case #2: off the record' };

// onChange: called after each step, so the report can update its status line.
export function createEpilogue({ store, onChange }) {
  const element = el('section', { class: 'epilogue', 'aria-labelledby': 'epilogue-title', tabindex: '-1' });

  // fresh: the step that has just happened, so only it animates in.
  function draw(fresh = null) {
    const progress = store.get();
    const state = epilogueState(progress);
    element.hidden = !state.arrived;
    if (!state.arrived) {
      element.replaceChildren();
      return;
    }
    const values = { codename: progress.codename };

    // filter(Boolean) drops the steps not reached yet: unlike el(),
    // replaceChildren would print them as the word "false".
    element.replaceChildren(...[
      el('p', { class: 'sheet__ref epilogue__ref' }, 'In tray'),
      el('h2', { id: 'epilogue-title', class: 'visually-hidden' }, 'In tray'),
      storyLine('epilogue.arrival', values, 'p'),
      noticeSheet(progress, state),
      state.acknowledgedAt && storyLine('epilogue.found', values, 'p'),
      state.acknowledgedAt && noteSheet(progress, fresh === 'note'),
      state.acknowledgedAt && (state.choice ? outcome(state.choice, values, fresh === 'outcome') : choice()),
    ].filter(Boolean));
  }

  // The notice itself, word for word, with the receipt at the bottom.
  function noticeSheet(progress, state) {
    return el('article', { class: 'sheet doc notice', 'aria-labelledby': 'notice-title' },
      el('header', { class: 'doc__header' },
        el('span', { class: 'mark mark--small', 'aria-hidden': 'true' },
          el('span', { class: 'mark__word' }, 'EXUN'),
          el('span', { class: 'mark__year' }, '2026')),
        el('h3', { id: 'notice-title', class: 'doc__title' }, notice.title)),
      el('p', { class: 'stamp doc__stamp', 'aria-hidden': 'true' }, 'Restricted'),
      renderDocument(notice, { progress }),
      el('div', { class: 'notice__receipt' },
        state.acknowledgedAt
          ? [
            el('p', { class: 'stamp stamp--blue notice__stamp', 'aria-hidden': 'true' }, 'Received'),
            el('p', { class: 'notice__when' }, `Receipt acknowledged ${formatDateTime(state.acknowledgedAt)}.`),
          ]
          : el('button', { class: 'btn', type: 'button', onClick: acknowledge }, 'Acknowledge receipt')));
  }

  // Agent Nano's note: a page torn from a notebook, in handwriting.
  function noteSheet(progress, isNew) {
    return el('article', {
      class: `notebook${isNew ? ' notebook--new' : ''}`,
      'aria-labelledby': 'note-title',
      tabindex: '-1',
    },
    // The blank "No." and "Date" lines printed on the notebook page
    el('p', { class: 'notebook__meta', 'aria-hidden': 'true' }, el('span', {}, 'No.'), el('span', {}, 'Date')),
    el('h3', { id: 'note-title', class: 'notebook__title hand' }, note.title),
    renderDocument(note, { progress }));
  }

  // Nano's last question, and the agent's two answers.
  function choice() {
    return el('div', { class: 'epilogue__choice', role: 'group', 'aria-labelledby': 'choice-question' },
      el('p', { id: 'choice-question', class: 'epilogue__question hand' }, note.question),
      el('div', { class: 'epilogue__buttons' },
        el('button', { class: 'btn btn--ghost', type: 'button', onClick: () => choose('comply') },
          storyLine('epilogue.chooseComply')),
        el('button', { class: 'btn', type: 'button', onClick: () => choose('continue') },
          storyLine('epilogue.chooseContinue'))));
  }

  function outcome(picked, values, isNew) {
    return el('div', { class: `epilogue__outcome${isNew ? ' epilogue__outcome--new' : ''}`, tabindex: '-1' },
      storyLine(`epilogue.${picked}`, values, 'p'),
      el('p', { class: `stamp epilogue__stamp${picked === 'comply' ? ' stamp--blue' : ''}` }, OUTCOME_STAMP[picked]));
  }

  // ---------- Steps ----------

  function acknowledge() {
    store.update((p) => acknowledgeNotice(p));
    draw('note');
    onChange();
    announce('Receipt acknowledged. EXUN is suspended. A handwritten note was tucked behind the notice.');
    bringIntoView(element.querySelector('.notebook'));
  }

  function choose(picked) {
    store.update((p) => chooseNext(p, picked));
    draw('outcome');
    onChange();
    announce(OUTCOME_STAMP[picked]);
    bringIntoView(element.querySelector('.epilogue__outcome'));
  }

  // Scroll to a new step and move the keyboard there, gliding unless the
  // device asks for reduced motion.
  function bringIntoView(target) {
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  draw();
  return {
    element,
    draw,
    // Called right after the report is filed: show the notice and go to it.
    arrive() {
      draw();
      announce('A notice marked Restricted has arrived in your in tray.');
      bringIntoView(element);
    },
  };
}
