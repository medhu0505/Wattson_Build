// Stage 01: Case Files.
// Left: the official documents, one at a time behind divider tabs.
// Right: the evidence board. Clicking an underlined detail in a document
// pins it to the board. Once all the key details are on the board, the
// agent files the folder, which clears the stage.

import '../styles/casefiles.css';
import canon from '../../content/canon.json';
import { el, announce } from './dom.js';
import { storyLine } from './story.js';
import { renderDocument, syncPinned } from './document.js';
import { createEvidenceBoard } from './evidenceBoard.js';
import { addPin, removePin, isPinned, keyProgress } from '../lib/evidence.js';
import { completeStage, isCompleted } from '../state/progress.js';

// The documents in this folder, in tab order, with the stamp each one carries.
const FOLDER = [
  { id: 'debrief', stamp: 'Confidential' },
  { id: 'transcript', stamp: 'Eyes only' },
  { id: 'asset', stamp: 'Inconclusive' },
];

const DOCUMENT_NAMES = Object.fromEntries(
  Object.entries(canon.documents).map(([id, doc]) => [id, doc.title])
);

// Remember which document was open, while the site stays open.
let openDocId = 'debrief';

export function renderCaseFiles(main, { store, go }) {
  const pinnedNow = (id) => isPinned(store.get().pins, id);

  // ---------- Documents with divider tabs ----------

  const tabList = el('div', { class: 'doc-tabs', role: 'tablist', 'aria-label': 'Documents in this folder' });
  const panel = el('article', { class: 'sheet doc', role: 'tabpanel', tabindex: '0' });

  function showDocument(docId, moveFocus = false) {
    openDocId = docId;
    for (const tab of tabList.children) {
      const selected = tab.dataset.doc === docId;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1; // only the open tab is in the Tab order
      if (selected && moveFocus) tab.focus();
    }

    const doc = canon.documents[docId];
    const entry = FOLDER.find((item) => item.id === docId);
    panel.setAttribute('aria-labelledby', `doc-tab-${docId}`);
    panel.replaceChildren(
      el('header', { class: 'doc__header' },
        el('span', { class: 'mark mark--small', 'aria-hidden': 'true' },
          el('span', { class: 'mark__word' }, 'EXUN'),
          el('span', { class: 'mark__year' }, '2026')),
        el('h2', { class: 'doc__title' }, doc.title),
        el('p', { class: 'stamp doc__stamp', 'aria-hidden': 'true' }, entry.stamp)
      ),
      renderDocument(doc, { progress: store.get(), isPinned: pinnedNow, onPin: togglePin })
    );
  }

  FOLDER.forEach((entry) => {
    tabList.append(el('button', {
      class: 'doc-tab',
      type: 'button',
      role: 'tab',
      id: `doc-tab-${entry.id}`,
      'data-doc': entry.id,
      onClick: () => showDocument(entry.id),
    }, canon.documents[entry.id].title));
  });

  // Arrow keys move between the divider tabs (the usual way tabs work).
  tabList.addEventListener('keydown', (event) => {
    const ids = FOLDER.map((entry) => entry.id);
    const index = ids.indexOf(openDocId);
    const targets = {
      ArrowRight: ids[(index + 1) % ids.length],
      ArrowLeft: ids[(index - 1 + ids.length) % ids.length],
      Home: ids[0],
      End: ids[ids.length - 1],
    };
    if (targets[event.key]) {
      event.preventDefault();
      showDocument(targets[event.key], true);
    }
  });

  // ---------- Evidence board ----------

  const counter = el('p', { class: 'board__count' });
  const filing = el('div', { class: 'board__filing' });

  const board = createEvidenceBoard({
    store,
    canonPins: canon.pins,
    documentNames: DOCUMENT_NAMES,
    onUnpin: (id) => {
      syncPinned(panel, pinnedNow);
      updateStatus();
      announce(`Unpinned: ${canon.pins[id].label}.`);
    },
  });

  function togglePin(id) {
    const wasPinned = pinnedNow(id);
    store.update((progress) => ({
      ...progress,
      pins: wasPinned ? removePin(progress.pins, id) : addPin(progress.pins, id),
    }));
    board.refresh(wasPinned ? null : id);
    syncPinned(panel, pinnedNow);
    updateStatus();

    const { found, total } = keyProgress(store.get().pins, canon.pins);
    announce(`${wasPinned ? 'Unpinned' : 'Pinned'}: ${canon.pins[id].label}. Key details ${found} of ${total}.`);
  }

  // Counter, and the "file" button (or the filed note once it's done).
  function updateStatus() {
    const progress = store.get();
    const { found, total, complete } = keyProgress(progress.pins, canon.pins);
    counter.replaceChildren(
      el('span', { class: 'board__count-label' }, 'Key details'),
      ` ${found} / ${total}`
    );
    counter.classList.toggle('board__count--complete', complete);

    if (isCompleted(progress, 'files')) {
      filing.replaceChildren(
        el('p', { class: 'stamp stamp--blue board__filed-stamp', 'aria-hidden': 'true' }, 'Filed'),
        storyLine('files.outro', { codename: progress.codename }, 'p'),
        el('button', { class: 'btn', type: 'button', onClick: () => go('forensics') }, 'Open folder 02: Energy Forensics')
      );
    } else {
      filing.replaceChildren(
        el('button', {
          class: 'btn',
          type: 'button',
          disabled: !complete,
          onClick: fileFolder,
        }, 'File to forensics'),
        el('p', { class: 'board__filing-note' }, complete
          ? 'Every key detail is on the board.'
          : 'Filing opens once every key detail is on the board.')
      );
    }
  }

  function fileFolder() {
    store.update((progress) => completeStage(progress, 'files'));
    updateStatus();
    announce('Folder filed. Folder 02, Energy Forensics, is now open.');
    filing.querySelector('button').focus();
  }

  // On phones the board is below the documents, so offer a quick jump.
  const jump = el('button', {
    class: 'board-jump',
    type: 'button',
    onClick: () => {
      board.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      board.element.focus({ preventScroll: true });
    },
  }, 'Go to evidence board');

  // ---------- Put it all together ----------

  main.append(
    el('div', { class: 'files' },
      el('div', { class: 'files__docs' },
        el('section', { class: 'files__slip' },
          el('p', { class: 'sheet__ref' }, 'Folder 01 / Case files'),
          el('h1', { class: 'sheet__title' }, 'Case Files'),
          storyLine('files.intro', { codename: store.get().codename }, 'p'),
          el('p', { id: 'pin-help', class: 'files__help' },
            'Underlined details can be pinned to the evidence board: click them, or Tab to them and press Enter. Click again to unpin.'),
          jump
        ),
        tabList,
        panel
      ),
      el('aside', { class: 'files__board', 'aria-labelledby': 'board-title' },
        el('header', { class: 'board__head' },
          el('h2', { id: 'board-title', class: 'board__title' }, 'Evidence board'),
          counter
        ),
        board.element,
        filing
      )
    )
  );

  showDocument(openDocId);
  updateStatus();

  // When this screen closes, stop the board watching its size.
  return () => board.destroy();
}
