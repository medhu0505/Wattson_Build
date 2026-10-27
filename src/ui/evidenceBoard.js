// The evidence board: a corkboard of index cards, one per pinned detail,
// joined by red string in the order they were pinned.
//
// Moving a card:
//   mouse / finger / pen – drag it
//   keyboard             – Tab to it, then arrow keys (hold Shift for big steps)
// Removing a card: its "unpin" button, or Delete / Backspace on the keyboard.

import { el } from './dom.js';
import { movePin, nudgePin, removePin, tiltFor, clamp01, bestColumns } from '../lib/evidence.js';

const SVG = 'http://www.w3.org/2000/svg';
const SMALL_STEP = 0.03;
const BIG_STEP = 0.1;

// onUnpin(id) is called when a card is removed from the board, so the
// documents can update too.
export function createEvidenceBoard({ store, canonPins, documentNames, onUnpin }) {
  const string = document.createElementNS(SVG, 'svg');
  string.setAttribute('class', 'board__string');
  string.setAttribute('aria-hidden', 'true');

  const cards = el('ul', { class: 'board__cards', 'aria-label': 'Pinned evidence' });
  const empty = el('p', { class: 'board__empty' }, 'Nothing pinned yet.');

  const surface = el('div', { class: 'board__surface', id: 'evidence-board' },
    string, cards, empty,
    el('p', { id: 'board-help', class: 'visually-hidden' },
      'Arrow keys move the card. Hold Shift to move further. Delete unpins it.')
  );

  // Redraw the string whenever the board changes size.
  const resizeWatcher = new ResizeObserver(() => drawString());
  resizeWatcher.observe(surface);

  // ---------- Drawing ----------

  // newId: the card that was just pinned, so only that one plays the
  // "dropping onto the board" animation.
  function refresh(newId = null) {
    const pins = store.get().pins.filter((pin) => canonPins[pin.id]);
    cards.replaceChildren(...pins.map((pin) => makeCard(pin, pin.id === newId)));
    empty.hidden = pins.length > 0;
    drawString();
  }

  function makeCard(pin, isNew) {
    const info = canonPins[pin.id];
    const card = el('li', {
      class: `evidence-card${isNew ? ' is-new' : ''}`,
      tabindex: '0',
      'data-id': pin.id,
      'aria-label': `${info.label}. From ${documentNames[info.doc]}.`,
      'aria-describedby': 'board-help',
      style: `--tilt: ${tiltFor(pin.id)}deg`,
    },
      el('span', { class: 'evidence-card__pin', 'aria-hidden': 'true' }),
      el('span', { class: 'evidence-card__source', 'aria-hidden': 'true' }, documentNames[info.doc]),
      el('span', { class: 'evidence-card__label', 'aria-hidden': 'true' }, info.label),
      el('button', {
        class: 'evidence-card__unpin',
        type: 'button',
        'aria-label': `Unpin ${info.label}`,
        onClick: () => unpin(pin.id),
      }, 'unpin')
    );
    place(card, pin.x, pin.y);
    card.addEventListener('pointerdown', (event) => startDrag(event, card, pin.id));
    card.addEventListener('keydown', (event) => onCardKey(event, card, pin.id));
    return card;
  }

  // Cards are positioned by CSS from --x and --y (see casefiles.css).
  function place(card, x, y) {
    card.style.setProperty('--x', x);
    card.style.setProperty('--y', y);
  }

  // Red string through the pin heads, in the order the cards were pinned.
  function drawString() {
    const width = surface.clientWidth;
    const height = surface.clientHeight;
    string.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const points = [...cards.children].map((card) => {
      const x = Number(card.style.getPropertyValue('--x'));
      const y = Number(card.style.getPropertyValue('--y'));
      // Same sums as the CSS: the card's left edge plus half its width.
      return [
        x * (width - card.offsetWidth) + card.offsetWidth / 2,
        y * (height - card.offsetHeight) + 10,
      ];
    });

    const line = document.createElementNS(SVG, 'polyline');
    line.setAttribute('points', points.map((point) => point.join(',')).join(' '));
    string.replaceChildren(line);
  }

  // ---------- Dragging (mouse, touch and pen all send "pointer" events) ----------

  function startDrag(event, card, id) {
    if (event.button !== 0 || event.target.closest('button')) return;
    event.preventDefault();
    card.setPointerCapture(event.pointerId); // keep getting events even if the pointer leaves the card
    card.focus({ preventScroll: true });
    card.classList.add('is-dragging');

    // How far a card can travel: the board size minus the card size.
    const roomX = surface.clientWidth - card.offsetWidth;
    const roomY = surface.clientHeight - card.offsetHeight;
    const startX = Number(card.style.getPropertyValue('--x'));
    const startY = Number(card.style.getPropertyValue('--y'));
    let x = startX;
    let y = startY;

    function onMove(moveEvent) {
      x = clamp01(startX + (moveEvent.clientX - event.clientX) / roomX);
      y = clamp01(startY + (moveEvent.clientY - event.clientY) / roomY);
      place(card, x, y);
      drawString();
    }

    function onEnd() {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onEnd);
      card.removeEventListener('pointercancel', onEnd);
      card.classList.remove('is-dragging');
      // Save once, when the card is let go.
      store.update((progress) => ({ ...progress, pins: movePin(progress.pins, id, x, y) }));
    }

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onEnd);
    card.addEventListener('pointercancel', onEnd);
  }

  // ---------- Keyboard ----------

  function onCardKey(event, card, id) {
    if (event.target !== card) return; // let the unpin button handle its own keys
    const step = event.shiftKey ? BIG_STEP : SMALL_STEP;
    const moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };

    if (moves[event.key]) {
      event.preventDefault(); // stop the page scrolling
      const [dx, dy] = moves[event.key];
      store.update((progress) => ({ ...progress, pins: nudgePin(progress.pins, id, dx, dy) }));
      const pin = store.get().pins.find((p) => p.id === id);
      place(card, pin.x, pin.y);
      drawString();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      unpin(id);
    }
  }

  function unpin(id) {
    // Remember which card to put the keyboard on next.
    const order = [...cards.children].map((card) => card.dataset.id);
    const index = order.indexOf(id);

    store.update((progress) => ({ ...progress, pins: removePin(progress.pins, id) }));
    refresh();
    onUnpin(id);

    const next = cards.children[Math.min(index, cards.children.length - 1)];
    (next ?? surface).focus();
  }

  // How many columns lay out this many cards best on the board as it is
  // right now. The card size comes from the board's CSS (--card-w, --card-h),
  // so it stays right on small screens, where the cards are smaller.
  // The grid is planned for at least 9 cards (the 7 key details and a couple
  // more), so it keeps the same shape while the agent pins things.
  function columns(count) {
    const style = getComputedStyle(surface);
    return bestColumns(Math.max(count, 9), {
      width: surface.clientWidth,
      height: surface.clientHeight,
      cardWidth: parseFloat(style.getPropertyValue('--card-w')) || 150,
      cardHeight: parseFloat(style.getPropertyValue('--card-h')) || 112,
    });
  }

  surface.setAttribute('tabindex', '-1'); // so focus can land here when the board empties
  refresh();

  // destroy() stops watching the board's size once the screen closes.
  return { element: surface, refresh, columns, destroy: () => resizeWatcher.disconnect() };
}
