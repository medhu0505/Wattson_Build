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
import { addPin, removePin, isPinned, keyProgress, isDocumentOpen, tidyPins } from '../lib/evidence.js';
import { completeStage, isCompleted } from '../state/progress.js';
import { getStage } from '../state/stages.js';
import { prefersReducedMotion } from './effects.js';

// The documents in this folder, in tab order, with the stamp each one carries.
// Agent Nano's log is sealed until the Machine Terminal is cleared (see
// "sealedUntil" in canon.json), so it shows as a sealed tab until then.
const FOLDER = [
  { id: 'debrief', stamp: 'Confidential' },
  { id: 'transcript', stamp: 'Eyes only' },
  { id: 'asset', stamp: 'Inconclusive' },
  { id: 'log', stamp: 'Immediate concern' },
];

const DOCUMENT_NAMES = Object.fromEntries(
  Object.entries(canon.documents).map(([id, doc]) => [id, doc.title])
);

// Remember which document was open, while the site stays open.
let openDocId = 'debrief';

// Other screens can ask for a document to be open next time the case files
// are shown (the machine terminal does this for Agent Nano's log).
export function setOpenDocument(docId) {
  if (FOLDER.some((entry) => entry.id === docId)) openDocId = docId;
}

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
    const open = isDocumentOpen(doc, store.get());
    panel.setAttribute('aria-labelledby', `doc-tab-${docId}`);
    panel.classList.toggle('doc--sealed', !open);
    panel.replaceChildren(
      el('header', { class: 'doc__header' },
        el('span', { class: 'mark mark--small', 'aria-hidden': 'true' },
          el('span', { class: 'mark__word' }, 'EXUN'),
          el('span', { class: 'mark__year' }, '2026')),
        el('h2', { class: 'doc__title' }, doc.title),
        el('p', { class: 'stamp doc__stamp', 'aria-hidden': 'true' }, open ? entry.stamp : 'Sealed')
      ),
      open
        ? renderDocument(doc, { progress: store.get(), isPinned: pinnedNow, onPin: togglePin })
        : sealedNotice(doc)
    );
  }

  // What a sealed document shows instead of its text.
  function sealedNotice(doc) {
    const stage = getStage(doc.sealedUntil);
    return el('div', { class: 'doc__sealed' },
      el('p', {}, `This document is sealed. It opens when folder ${stage.tab}, ${stage.title}, is cleared.`),
      el('p', { class: 'doc__sealed-meta' }, `Filed by ${doc.author}.`));
  }

  function drawTabs() {
    tabList.replaceChildren(...FOLDER.map((entry) => {
      const sealed = !isDocumentOpen(canon.documents[entry.id], store.get());
      return el('button', {
        class: `doc-tab${sealed ? ' doc-tab--sealed' : ''}`,
        type: 'button',
        role: 'tab',
        id: `doc-tab-${entry.id}`,
        'data-doc': entry.id,
        onClick: () => showDocument(entry.id),
      }, canon.documents[entry.id].title, sealed && el('span', { class: 'doc-tab__status' }, ' sealed'));
    }));
  }
  drawTabs();

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
      // Glide there, unless the device asks for reduced motion.
      board.element.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
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
          counter,
          // Spread the cards out again (handy on phones, where they pile up).
          el('button', {
            class: 'switch board__tidy',
            type: 'button',
            onClick: () => {
              store.update((progress) => ({ ...progress, pins: tidyPins(progress.pins) }));
              board.refresh();
              announce('Cards spread out across the board.');
            },
          }, 'Tidy cards')
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
