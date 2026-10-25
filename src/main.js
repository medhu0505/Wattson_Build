// Starting point of the site. Loads fonts and styles, reads saved progress,
// and draws the right screen.

// Fonts are bundled with the site (no outside font service).
// Roboto Mono matches the official PDFs; VT323 is the arcade/CRT screen font.
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
import '@fontsource/roboto-mono/700.css';
import '@fontsource/vt323/400.css';

import './styles/base.css';
import './styles/agency.css';

import { createStore } from './state/store.js';
import { createRouter } from './router.js';
import { renderShell } from './ui/shell.js';
import { views } from './ui/views.js';

// The router decides where each screen scrolls to. Without this the browser
// jumps back to wherever the page was scrolled before a reload.
history.scrollRestoration = 'manual';

const store = createStore();

const router = createRouter({
  store,
  views,
  main: document.getElementById('main'),
  onRoute: (stageId) => renderShell(store.get(), stageId),
});

// Whenever progress changes (a stage cleared, a pin added...), redraw the tabs.
store.subscribe((progress) => renderShell(progress, router.activeId()));

// The "skip to folder" link: jump focus to the open folder without
// changing the address (the address is used for stages).
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  document.getElementById('main').focus();
});

router.show();
