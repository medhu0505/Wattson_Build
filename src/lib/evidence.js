// Rules for the evidence board. No web page code in here, so the tests can
// check it directly.
//
// A pin is saved as { id, x, y }.
//   id – which detail it is (a key in canon.json "pins")
//   x  – 0 means the card touches the board's left edge, 1 the right edge
//   y  – 0 means the card touches the top edge, 1 the bottom edge
// Using 0–1 instead of pixels means cards stay in place when the board
// changes size (a phone vs a laptop, or a resized window).

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

// Places a new card can land, spread over the board. They are tried in
// order; a place already covered by a card is skipped.
const SPOTS = [
  [0.04, 0.03], [0.62, 0.02], [0.30, 0.20], [0.96, 0.17],
  [0.02, 0.40], [0.58, 0.37], [0.28, 0.58], [0.94, 0.55],
  [0.03, 0.78], [0.62, 0.74], [0.33, 0.97], [0.97, 0.93],
  [0.00, 0.99], [0.80, 0.40], [0.48, 0.86],
];
const TOO_CLOSE = 0.14;

export function nextSpot(pins) {
  const isFree = ([x, y]) => pins.every((pin) => Math.hypot(pin.x - x, pin.y - y) > TOO_CLOSE);
  const spot = SPOTS.find(isFree) ?? SPOTS[pins.length % SPOTS.length];
  return { x: spot[0], y: spot[1] };
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

// A small, fixed tilt for each card (between -3 and 3 degrees), so the
// board looks hand-pinned. The same card always gets the same tilt.
export function tiltFor(id) {
  let total = 0;
  for (const character of id) total += character.charCodeAt(0);
  return (total % 7) - 3;
}
