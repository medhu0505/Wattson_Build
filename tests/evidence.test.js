// Tests for the evidence board rules, and checks that canon.json is wired up
// correctly (every clickable detail exists, nothing is missing).

import { describe, it, expect } from 'vitest';
import {
  keyPinIds, isPinned, keyProgress, addPin, removePin, movePin, nudgePin,
  nextSpot, clamp01, tiltFor,
} from '../src/lib/evidence.js';
import canon from '../content/canon.json';
import { STAGE_IDS } from '../src/state/stages.js';

const pins = {
  a: { label: 'A', key: true },
  b: { label: 'B', key: false },
  c: { label: 'C', key: true },
};

describe('key details', () => {
  it('lists only the key details', () => {
    expect(keyPinIds(pins)).toEqual(['a', 'c']);
  });

  it('counts key details on the board and ignores the rest', () => {
    expect(keyProgress([], pins)).toEqual({ found: 0, total: 2, complete: false });
    expect(keyProgress([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: 0 }], pins))
      .toEqual({ found: 1, total: 2, complete: false });
    expect(keyProgress([{ id: 'c', x: 0, y: 0 }, { id: 'a', x: 0, y: 0 }], pins).complete).toBe(true);
  });
});

describe('pinning and unpinning', () => {
  it('adds a pin once, however many times it is clicked', () => {
    let board = addPin([], 'a');
    board = addPin(board, 'a');
    expect(board).toHaveLength(1);
    expect(isPinned(board, 'a')).toBe(true);
  });

  it('removes a pin', () => {
    const board = removePin(addPin(addPin([], 'a'), 'b'), 'a');
    expect(board.map((pin) => pin.id)).toEqual(['b']);
  });

  it('does not change the old list', () => {
    const before = [];
    addPin(before, 'a');
    expect(before).toEqual([]);
  });

  it('puts new cards in different places', () => {
    let board = [];
    for (const id of ['a', 'b', 'c', 'd', 'e']) board = addPin(board, id);
    const places = new Set(board.map((pin) => `${pin.x},${pin.y}`));
    expect(places.size).toBe(5);
  });

  it('still finds a place when the board is crowded', () => {
    let board = [];
    for (let i = 0; i < 40; i += 1) board = addPin(board, `pin-${i}`);
    expect(board).toHaveLength(40);
    for (const pin of board) {
      expect(pin.x).toBeGreaterThanOrEqual(0);
      expect(pin.x).toBeLessThanOrEqual(1);
    }
    expect(nextSpot(board)).toHaveProperty('x');
  });
});

describe('moving cards', () => {
  it('moves a card to a new place', () => {
    const board = movePin(addPin([], 'a', { x: 0.1, y: 0.1 }), 'a', 0.5, 0.6);
    expect(board[0]).toMatchObject({ x: 0.5, y: 0.6 });
  });

  it('never lets a card leave the board', () => {
    const board = movePin(addPin([], 'a'), 'a', -2, 7);
    expect(board[0]).toMatchObject({ x: 0, y: 1 });
    expect(clamp01(0.3)).toBe(0.3);
  });

  it('nudges a card with the arrow keys, stopping at the edge', () => {
    let board = addPin([], 'a', { x: 0.98, y: 0.5 });
    board = nudgePin(board, 'a', 0.05, -0.1);
    expect(board[0].x).toBe(1);
    expect(board[0].y).toBeCloseTo(0.4);
  });

  it('ignores a nudge for a card that is not pinned', () => {
    const board = addPin([], 'a');
    expect(nudgePin(board, 'zzz', 0.1, 0.1)).toBe(board);
  });

  it('gives each card a small fixed tilt', () => {
    expect(tiltFor('machine-id')).toBe(tiltFor('machine-id'));
    for (const id of Object.keys(canon.pins)) {
      expect(Math.abs(tiltFor(id))).toBeLessThanOrEqual(3);
    }
  });
});

// ---------- Checks on content/canon.json itself ----------

// Walk every piece of text in every document and collect what it refers to.
function collectSegments() {
  const segments = [];
  const take = (list) => list.forEach((piece) => {
    if (piece && typeof piece === 'object') segments.push(piece);
  });
  for (const doc of Object.values(canon.documents)) {
    for (const block of doc.blocks) {
      if (block.text && Array.isArray(block.text)) take(block.text);
      if (block.note) take(block.note);
      if (block.rows) block.rows.forEach(take);
      if (block.items && Array.isArray(block.items[0])) block.items.forEach(take);
    }
  }
  return segments;
}

describe('canon.json', () => {
  const segments = collectSegments();
  const pinnedInText = new Set(segments.filter((s) => s.pin).map((s) => s.pin));

  it('has seven key details for the case files', () => {
    expect(keyPinIds(canon.pins)).toHaveLength(7);
  });

  it('every clickable detail in the text is listed under "pins"', () => {
    for (const id of pinnedInText) expect(canon.pins).toHaveProperty(id);
  });

  it('every listed pin can actually be clicked somewhere', () => {
    for (const id of Object.keys(canon.pins)) expect(pinnedInText.has(id)).toBe(true);
  });

  it('no key detail is hidden behind a redaction that lifts later', () => {
    const hiddenKeys = segments.filter((s) => s.clearance && s.pin && canon.pins[s.pin].key);
    expect(hiddenKeys).toEqual([]);
  });

  it('every redaction lifts at a real stage after the case files', () => {
    for (const s of segments.filter((piece) => piece.clearance)) {
      expect(STAGE_IDS.indexOf(s.clearance)).toBeGreaterThan(STAGE_IDS.indexOf('files'));
    }
  });
});
