// Rules for the evidence board. No web page code in here, so the tests can
// check it directly.
//
// A pin is saved as { id, x, y }.
//   id – which detail it is (a key in canon.json "pins")
//   x  – 0 means the card touches the board's left edge, 1 the right edge
//   y  – 0 means the card touches the top edge, 1 the bottom edge
// Using 0–1 instead of pixels means cards stay in place when the board
// changes size (a phone vs a laptop, or a resized window).

import { isCompleted } from '../state/progress.js';

// Some documents arrive later in the case: "sealedUntil" names the stage
// that must be cleared before they can be read.
export function isDocumentOpen(doc, progress) {
  return !doc.sealedUntil || isCompleted(progress, doc.sealedUntil);
}

// The details that must be on the board before the folder can be filed.
export function keyPinIds(canonPins) {
  return Object.keys(canonPins).filter((id) => canonPins[id].key);
}

export function isPinned(pins, id) {
  return pins.some((pin) => pin.id === id);
}

// How many key details are on the board, out of how many.
export function keyProgress(pins, canonPins) {
  const keys = keyPinIds(canonPins);
  const found = keys.filter((id) => isPinned(pins, id)).length;
  return { found, total: keys.length, complete: found === keys.length };
}

// Keep a number between 0 and 1.
export function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

// Places for cards in a tidy grid, read left to right, top to bottom.
// columns: how many cards fit side by side on the board (the board works
// this out from its width). There are as many rows as the cards need, and at
// least three, so a handful of cards stays near the top instead of spreading
// to the corners.
export function gridSpots(count, columns = 3) {
  const across = Math.max(1, Math.floor(columns));
  const rows = Math.max(3, Math.ceil(count / across));
  const spots = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < across; col += 1) {
      spots.push({ x: across === 1 ? 0 : col / (across - 1), y: row / (rows - 1) });
    }
  }
  return spots;
}

// How many columns lay out this many cards with the least overlap, on a
// board of this size (all in pixels). Too few columns and the rows squash
// together; too many and the columns do. Ties go to fewer columns.
export function bestColumns(count, { width, height, cardWidth, cardHeight }) {
  let best = 1;
  let bestOverlap = Infinity;
  const most = Math.max(1, Math.floor(width / (cardWidth / 2)));
  for (let across = 1; across <= most; across += 1) {
    const rows = Math.max(3, Math.ceil(count / across));
    const stepX = across > 1 ? (width - cardWidth) / (across - 1) : Infinity;
    const stepY = (height - cardHeight) / (rows - 1);
    // How much of a card is hidden by its neighbour to the right, and below
    const overlap = Math.max(0, 1 - stepX / cardWidth) + Math.max(0, 1 - stepY / cardHeight);
    if (overlap < bestOverlap - 1e-9) {
      best = across;
      bestOverlap = overlap;
    }
  }
  return best;
}

// Where a newly pinned card lands: the first place in the grid not already
// covered by a card.
const TOO_CLOSE = 0.14;

export function nextSpot(pins, columns = 3) {
  const isFree = (spot) => pins.every((pin) => Math.hypot(pin.x - spot.x, pin.y - spot.y) > TOO_CLOSE);
  const grid = gridSpots(pins.length + 1, columns);
  return grid.find(isFree) ?? grid[pins.length % grid.length];
}

// Each function below returns a NEW list of pins and leaves the old one alone.

export function addPin(pins, id, spot = nextSpot(pins)) {
  if (isPinned(pins, id)) return pins;
  return [...pins, { id, x: clamp01(spot.x), y: clamp01(spot.y) }];
}

export function removePin(pins, id) {
  return pins.filter((pin) => pin.id !== id);
}

// Put a pin at an exact place (used at the end of a drag).
export function movePin(pins, id, x, y) {
  return pins.map((pin) => (pin.id === id ? { ...pin, x: clamp01(x), y: clamp01(y) } : pin));
}

// Shift a pin by a small amount (used by the arrow keys).
export function nudgePin(pins, id, dx, dy) {
  const pin = pins.find((p) => p.id === id);
  if (!pin) return pins;
  return movePin(pins, id, pin.x + dx, pin.y + dy);
}

// Lay every card out in the grid again, in the order they were pinned (the
// "Tidy cards" button), so none of them sits on top of another.
export function tidyPins(pins, columns = 3) {
  const spots = gridSpots(pins.length, columns);
  return pins.map((pin, index) => ({ ...pin, ...spots[index] }));
}

// A small, fixed tilt for each card (between -3 and 3 degrees), so the
// board looks hand-pinned. The same card always gets the same tilt.
export function tiltFor(id) {
  let total = 0;
  for (const character of id) total += character.charCodeAt(0);
  return (total % 7) - 3;
}
