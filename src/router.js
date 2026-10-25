// The router decides which screen to draw, based on the web address.
// Addresses look like  index.html#/files  – the part after "#/" is a stage id.
// Using "#" means it works on GitHub Pages without any server setup.

import { getStage } from './state/stages.js';
import { isUnlocked, currentStageId } from './state/progress.js';
import { renderSealed } from './ui/sealed.js';

export function createRouter({ store, views, main, onRoute }) {
  let cleanup = null;    // the open screen can hand us a function to tidy up when it closes
  let activeId = null;

  // "#/files" -> "files". Anything else -> null.
  function stageIdFromHash() {
    const match = window.location.hash.match(/^#\/([a-z]+)$/);
    return match && getStage(match[1]) ? match[1] : null;
  }

  // Go to a stage. replace = true swaps the address without adding a
  // "back button" step (used when we redirect).
  function go(stageId, replace = false) {
    const hash = `#/${stageId}`;
    if (replace) {
      history.replaceState(null, '', hash);
      show();
    } else if (window.location.hash === hash) {
      show(); // already there: just redraw
    } else {
      window.location.hash = hash; // fires 'hashchange', which calls show()
    }
  }

  // Draw the screen for the current address.
  function show() {
    const progress = store.get();
    const stageId = stageIdFromHash();

    // No stage (or a made-up one) in the address: send the agent to where they're up to.
    if (!stageId) {
      go(currentStageId(progress), true);
      return;
    }

    if (cleanup) cleanup();
    cleanup = null;
    main.replaceChildren();
    activeId = stageId;

    const context = { store, go, stage: getStage(stageId) };
    if (isUnlocked(progress, stageId)) {
      cleanup = views[stageId](main, context) || null;
    } else {
      cleanup = renderSealed(main, context) || null;
    }

    onRoute(stageId);

    // Move keyboard / screen-reader focus to the new screen's heading.
    const heading = main.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', show);

  return { show, go, activeId: () => activeId };
}
