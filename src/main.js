// Starting point of the site. Loads fonts and styles, reads saved progress,
// and draws the right screen.

// Fonts are bundled with the site (no outside font service).
// Roboto Mono matches the official PDFs; VT323 is the arcade/CRT screen font;
// Indie Flower is handwriting (Agent Nano's log and red-pen notes).
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
import '@fontsource/roboto-mono/700.css';
import '@fontsource/vt323/400.css';
import '@fontsource/indie-flower/400.css';

import './styles/base.css';
import './styles/agency.css';
import './styles/bleed.css';
import './styles/print.css';

import { createStore } from './state/store.js';
import { getBrowserStorage, completeStage } from './state/progress.js';
import { STAGE_IDS, getStage } from './state/stages.js';
import { createRouter } from './router.js';
import { renderShell } from './ui/shell.js';
import { views } from './ui/views.js';
import { openHints } from './ui/hints.js';
import { renderColophon } from './ui/colophon.js';
import { applyEffects, onReducedMotionChange } from './ui/effects.js';
import { setAudioEnabled } from './ui/audio.js';
import { announce } from './ui/dom.js';

// The router decides where each screen scrolls to. Without this the browser
// jumps back to wherever the page was scrolled before a reload.
history.scrollRestoration = 'manual';

// Supervisor mode for judges: add ?supervisor=1 to the address, e.g.
//   https://<site>/?supervisor=1#/forensics
// Every folder opens, and progress is saved separately from the agent's.
const supervisor = new URLSearchParams(window.location.search).get('supervisor') === '1';

const store = createStore(getBrowserStorage(), { supervisor });

// What the buttons in the top bar do.
const controls = {
  toggleGlitch: () => store.update((p) => ({ ...p, settings: { ...p.settings, glitch: !p.settings.glitch } })),
  toggleAudio: () => store.update((p) => ({ ...p, settings: { ...p.settings, audio: !p.settings.audio } })),
  openHints: (stageId) => openHints(store, stageId),

  // The Reset button in the top bar, once the agent has said yes.
  resetAll: () => {
    store.reset();
    announce('All progress erased. The case starts again from intake.');
    router.go('intake');
  },

  // Supervisor bar only:
  markAllCleared: () => {
    store.update((p) => STAGE_IDS.reduce((progress, id) => completeStage(progress, id), p));
    router.show(); // redraw the open screen so it shows its cleared state
  },
  resetSupervisor: () => {
    store.reset();
    router.show();
  },
  // The current page without "?supervisor=1".
  exitSupervisorHref: () => `${window.location.pathname}${window.location.hash}`,
};

// Redraw the top bar and tabs, and apply the glitch and sound settings.
function refreshChrome(stageId) {
  const progress = store.get();
  renderShell(progress, stageId, controls);
  applyEffects(progress);
  setAudioEnabled(progress.settings.audio);
}

const router = createRouter({
  store,
  views,
  main: document.getElementById('main'),
  onRoute: (stageId) => {
    // Lets the CSS style a stage's whole page (the machine screen goes dark).
    document.body.dataset.stage = stageId;
    // The browser tab (and screen readers) say which folder is open.
    document.title = `${getStage(stageId).title} · EXUN Case Terminal`;
    refreshChrome(stageId);
  },
});

// Whenever progress changes (a stage cleared, a pin added, a switch flipped), redraw.
store.subscribe(() => refreshChrome(router.activeId()));

// If the device's reduce-motion setting changes while the site is open, follow it.
onReducedMotionChange(() => refreshChrome(router.activeId()));

// The "skip to folder" link: jump focus to the open folder without
// changing the address (the address is used for stages).
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  document.getElementById('main').focus();
});

renderColophon();
router.show();
