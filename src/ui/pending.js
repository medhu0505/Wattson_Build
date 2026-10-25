// TEMPORARY: a stand-in screen for stages that haven't been built yet.
// Each milestone replaces one of these with the real screen.

import { el } from './dom.js';

export function pendingView(milestone) {
  return function render(main, { stage }) {
    main.append(
      el('section', { class: 'sheet' },
        el('p', { class: 'sheet__ref' }, `FOLDER ${stage.tab} / ${stage.title.toUpperCase()}`),
        el('h1', { class: 'sheet__title' }, stage.title),
        el('p', {}, `Under construction: built in milestone ${milestone}.`)
      )
    );
  };
}
