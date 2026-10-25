// The hints window ("field handbook"). Opened from the Hints button in the
// top bar; shows the open stage's hints one at a time.
// It's a native <dialog>: Escape closes it, and the keyboard stays inside
// it while it's open.

import '../styles/hints.css';
import hints from '../../content/hints.json';
import canon from '../../content/canon.json';
import energy from '../../data/energy.json';
import { el } from './dom.js';
import { getStage } from '../state/stages.js';
import { hintsFor, hintsUsed, hintValues, revealNextHint, HINTS_PER_STAGE } from '../lib/hints.js';

const values = hintValues({ canon, energy });
let dialog = null; // made the first time it's needed, then reused

export function openHints(store, stageId) {
  if (!dialog) {
    dialog = el('dialog', { class: 'hints', 'aria-labelledby': 'hints-title' });
    // Clicking the dimmed background (outside the card) closes it.
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    // The top bar is redrawn while the window is open, so put the keyboard
    // back on the (new) Hints button when it closes.
    dialog.addEventListener('close', () => document.querySelector('[data-setting="hints"]')?.focus());
    document.body.append(dialog);
  }
  draw(store, stageId);
  dialog.showModal();
}

function draw(store, stageId) {
  const stage = getStage(stageId);
  const all = hintsFor(stageId, hints, values);
  const used = hintsUsed(store.get(), stageId);

  function showNext() {
    store.update((progress) => revealNextHint(progress, stageId));
    draw(store, stageId);
    // Move to the new hint so screen readers read it out.
    dialog.querySelector(`#hint-${used + 1}`)?.focus();
  }

  dialog.replaceChildren(...[
    el('p', { class: 'sheet__ref' }, `Field handbook / Folder ${stage.tab}`),
    el('h2', { id: 'hints-title', class: 'hints__title' }, `Hints: ${stage.title}`),
    used === 0 && el('p', { class: 'hints__intro' }, 'Each hint gives a little more away. The case report notes how many you open.'),
    used > 0 && el('ol', { class: 'hints__list' },
      all.slice(0, used).map((hint, index) => el('li', { id: `hint-${index + 1}`, tabindex: '-1' }, hint))),
    el('div', { class: 'hints__actions' },
      used < HINTS_PER_STAGE
        ? el('button', { class: 'btn', type: 'button', onClick: showNext }, `Show hint ${used + 1} of ${HINTS_PER_STAGE}`)
        : el('p', { class: 'hints__done' }, 'All three hints shown.'),
      el('button', { class: 'btn btn--ghost', type: 'button', onClick: () => dialog.close() }, 'Close')),
  ].filter(Boolean));
}
