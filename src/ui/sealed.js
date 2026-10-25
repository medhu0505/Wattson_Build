// Shown when an agent opens a stage they haven't unlocked yet.

import { el } from './dom.js';
import { currentStageId } from '../state/progress.js';
import { getStage } from '../state/stages.js';

export function renderSealed(main, { store, go, stage }) {
  const current = getStage(currentStageId(store.get()));

  main.append(
    el('section', { class: 'sheet sheet--sealed' },
      el('p', { class: 'sheet__ref' }, `FOLDER ${stage.tab} / ${stage.title.toUpperCase()}`),
      el('h1', { class: 'sheet__title' }, 'Folder sealed'),
      el('p', { class: 'stamp stamp--big', 'aria-hidden': 'true' }, 'Sealed'),
      el('p', {}, 'This folder opens once the previous folder has been cleared.'),
      el('p', {},
        el('button', { class: 'btn', type: 'button', onClick: () => go(current.id) },
          `Return to folder ${current.tab}: ${current.title}`)
      )
    )
  );
}
