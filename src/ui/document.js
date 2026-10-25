// Draws an official document from content/canon.json onto the page:
// memo boxes, paragraphs, transcript lines, redaction bars and the
// clickable details that can be pinned to the evidence board.

import { el } from './dom.js';
import { artSlot } from './artSlot.js';
import { isCompleted } from '../state/progress.js';
import { getStage } from '../state/stages.js';

// options:
//   progress   – the agent's progress (decides which redactions have lifted)
//   isPinned   – function(id) -> true if that detail is on the board
//   onPin      – function(id), called when a detail is clicked.
//                Leave it out and details are shown as plain text.
export function renderDocument(doc, options) {
  return el('div', { class: 'doc__body' }, doc.blocks.map((block) => renderBlock(block, options)));
}

// After pinning or unpinning, mark every copy of each detail as pinned or
// not (the date and time in Transcript A are two copies of one detail).
export function syncPinned(container, isPinned) {
  for (const phrase of container.querySelectorAll('[data-pin]')) {
    phrase.setAttribute('aria-pressed', String(isPinned(phrase.dataset.pin)));
  }
}

function renderBlock(block, options) {
  const pieces = (list) => list.map((piece) => renderPiece(piece, options));

  switch (block.type) {
    case 'box':
      return el('div', { class: `doc-box${block.small ? ' doc-box--small' : ''}` },
        block.rows.map((row) => el('p', {}, pieces(row))));

    case 'para':
      return el('p', { class: 'doc-para' }, pieces(block.text));

    case 'heading':
      return el('h3', { class: 'doc-heading' }, block.text);

    case 'direction': // stage directions in the transcript, e.g. (POI-1 hurriedly leaves.)
      return el('p', { class: 'doc-direction' }, pieces(block.text));

    case 'line': // one person speaking in the transcript
      return el('p', { class: 'doc-line' },
        el('strong', {}, block.speaker, block.note ? [' ', pieces(block.note)] : null, ':'),
        ' ', pieces(block.text));

    case 'list':
      return el('ol', { class: 'doc-list' }, block.items.map((item) => el('li', {}, pieces(item))));

    case 'photos': // the two photos are redacted in the PDF, so they are here too
      return el('div', { class: 'doc-photos' },
        block.items.map((item, index) =>
          el('div', { class: 'polaroid', role: 'img', 'aria-label': `Photo ${index + 1}, redacted` },
            el('div', { class: 'polaroid__image' },
              el('span', { class: 'polaroid__sticker', 'aria-hidden': 'true' }, '[REDACTED]')))),
        el('div', { class: 'doc-photos__captions' },
          block.items.map((item) => el('p', {}, item.caption))));

    default:
      return el('p', {}, `Unknown block type: ${block.type}`);
  }
}

function renderPiece(piece, options) {
  if (typeof piece === 'string') return piece;

  // Redacted in the PDF itself: stays redacted for ever.
  if (piece.redacted) {
    return el('span', { class: 'redacted redacted--canon' }, piece.text);
  }

  // A signature line. The team's signature artwork goes in the art slot.
  if (piece.signature) {
    return artSlot(`signature-${piece.signature}`, {
      inline: true,
      className: 'signature',
      fallback: el('span', { class: 'signature__line' },
        el('span', { class: 'signature__slot' }, 'signature slot')),
    });
  }

  // Hidden until a later stage is cleared.
  if (piece.clearance && !isCompleted(options.progress, piece.clearance)) {
    return redactionBar(piece);
  }

  let content = piece.strong ? el('strong', {}, piece.text) : piece.text;

  if (piece.pin && options.onPin) {
    content = pinnable(piece.pin, content, options);
  }

  // A redaction that has lifted: shown, with a faint mark.
  if (piece.clearance) {
    content = el('span', { class: 'declassified', title: 'Declassified' },
      content, el('span', { class: 'visually-hidden' }, ' (declassified)'));
  }

  return content;
}

// A black bar exactly as long as the hidden words (every letter takes the
// same width in this font). The real words are not put on the page at all.
function redactionBar(piece) {
  const stage = getStage(piece.clearance);
  const filler = piece.text.replace(/\S/g, 'x');
  return el('span', {
    class: 'redacted redacted--clearance',
    role: 'img',
    'aria-label': `redacted until folder ${stage.tab} is cleared`,
    title: `Lifts when folder ${stage.tab}, ${stage.title}, is cleared`,
  }, filler);
}

// A detail the agent can click (or press Enter/Space on) to pin it.
// It works like a toggle button: aria-pressed says whether it's pinned.
function pinnable(pinId, content, options) {
  const phrase = el('span', {
    class: 'pinnable',
    role: 'button',
    tabindex: '0',
    'data-pin': pinId,
    'aria-pressed': String(options.isPinned(pinId)),
    'aria-describedby': 'pin-help',
  }, content);

  phrase.addEventListener('click', () => options.onPin(pinId));
  phrase.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); // stop Space from scrolling the page
      options.onPin(pinId);
    }
  });
  return phrase;
}
