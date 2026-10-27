// Tests for the evidence board rules, and checks that canon.json is wired up
// correctly (every clickable detail exists, nothing is missing).

import { describe, it, expect } from 'vitest';
import {
  keyPinIds, isPinned, keyProgress, addPin, removePin, movePin, nudgePin,
  nextSpot, clamp01, tiltFor, isDocumentOpen, tidyPins, gridSpots, bestColumns,
} from '../src/lib/evidence.js';
import canon from '../content/canon.json';
import { STAGE_IDS } from '../src/state/stages.js';
import { createProgress, completeStage } from '../src/state/progress.js';

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

  it('tidies a crowded board: same cards, same order, all in different places', () => {
    const crowded = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, x: 0.5, y: 0.5 }));
    const tidy = tidyPins(crowded);
    expect(tidy.map((pin) => pin.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(new Set(tidy.map((pin) => `${pin.x},${pin.y}`)).size).toBe(6);
    expect(tidyPins([])).toEqual([]);
  });

  it('tidies into a grid that fits the board, with no two cards overlapping', () => {
    const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id, x: 0.5, y: 0.5 }));
    const tidy = tidyPins(seven, 3);
    // 3 across and 3 down: x is 0, 0.5 or 1, and y is 0, 0.5 or 1.
    expect(tidy.map((pin) => [pin.x, pin.y])).toEqual([
      [0, 0], [0.5, 0], [1, 0], [0, 0.5], [0.5, 0.5], [1, 0.5], [0, 1],
    ]);
    // On a narrow board with room for one card across, they stack in one column.
    expect(new Set(tidyPins(seven, 1).map((pin) => pin.x))).toEqual(new Set([0]));
  });

  it('adds rows when there are more cards than the grid holds', () => {
    expect(gridSpots(4, 3)).toHaveLength(9);
    expect(gridSpots(12, 3)).toHaveLength(12);
    expect(gridSpots(12, 3).at(-1)).toEqual({ x: 1, y: 1 });
  });

  it('picks the number of columns with the least overlap for the board', () => {
    const card = { cardWidth: 150, cardHeight: 112 };
    // A laptop-sized board: 8 cards fit 3 across and 3 down.
    expect(bestColumns(8, { width: 440, height: 360, ...card })).toBe(3);
    // A wide board still uses 3 across for 9 cards (plenty of room, no overlap).
    expect(bestColumns(9, { width: 840, height: 520, ...card })).toBe(3);
    // A phone-sized board: 2 across.
    expect(bestColumns(8, { width: 300, height: 460, cardWidth: 132, cardHeight: 106 })).toBe(2);
    // A board too narrow for two cards: 1 across.
    expect(bestColumns(4, { width: 160, height: 600, ...card })).toBe(1);
  });

  it('puts a new card in the first free place in the grid', () => {
    let board = [];
    for (const id of ['a', 'b', 'c', 'd']) board = addPin(board, id, nextSpot(board, 3));
    expect(board.map((pin) => [pin.x, pin.y])).toEqual([[0, 0], [0.5, 0], [1, 0], [0, 0.5]]);
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

  it('no key detail is inside a document that is sealed', () => {
    for (const id of keyPinIds(canon.pins)) {
      expect(canon.documents[canon.pins[id].doc].sealedUntil).toBeUndefined();
    }
  });
});

// All the words of a document, joined up, for checking quotes against it.
function documentText(doc) {
  const words = [];
  const take = (list) => list.forEach((piece) => words.push(typeof piece === 'string' ? piece : piece.text ?? ''));
  for (const block of doc.blocks) {
    if (Array.isArray(block.text)) take(block.text);
    if (block.rows) block.rows.forEach(take);
  }
  return words.join('');
}

describe('Agent Nano’s Progress Assesment Log', () => {
  const log = canon.documents.log;
  const text = documentText(log);

  it('is sealed until the Machine Terminal is cleared', () => {
    let progress = createProgress();
    for (const id of STAGE_IDS.slice(0, STAGE_IDS.indexOf('machine'))) progress = completeStage(progress, id);
    expect(isDocumentOpen(log, progress)).toBe(false);
    expect(isDocumentOpen(log, completeStage(progress, 'machine'))).toBe(true);
  });

  it('leaves the other documents open from the start', () => {
    for (const id of ['debrief', 'transcript', 'asset', 'dossier']) {
      expect(isDocumentOpen(canon.documents[id], createProgress())).toBe(true);
    }
  });

  it('keeps the PDF’s wording, typos included', () => {
    expect(log.title).toBe('Progress Assesment Log');
    expect(text).toContain('the code analysts reverted and told me');
    expect(text).toContain('BUT BUT BUT BUT BUT.');
  });

  it('quotes its concern and question word for word', () => {
    expect(text).toContain(log.concern);
    expect(text).toContain(log.question);
    expect(text).toContain(log.written.split(',')[0]); // 23:54
  });

  it('is where the source code date comes from', () => {
    expect(canon.machine.sourceCodeObtained).toBe('24 October');
    expect(text).toContain('game source code on the 24th');
  });
});

describe('red-pen notes', () => {
  const notes = [];
  for (const doc of Object.values(canon.documents)) {
    for (const block of doc.blocks) {
      for (const row of block.rows ?? [block.text ?? []]) {
        for (const piece of row) if (piece?.penNote) notes.push(piece.penNote);
      }
    }
  }

  it('there is one, on Transcript A', () => {
    expect(notes).toHaveLength(1);
  });

  it('every note is quoted word for word from a canon document', () => {
    for (const note of notes) expect(documentText(canon.documents[note.quotes])).toContain(note.text);
  });

  it('every note appears at a real stage after the case files', () => {
    for (const note of notes) expect(STAGE_IDS.indexOf(note.after)).toBeGreaterThan(STAGE_IDS.indexOf('files'));
  });
});

describe('the canon timeline', () => {
  it('names a real document as the source of each event', () => {
    for (const event of canon.timeline) expect(canon.documents).toHaveProperty(event.source);
  });

  it('runs from 23 to 27 October in order', () => {
    const days = canon.timeline.map((event) => Number(event.when.slice(0, 2)));
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(days[0]).toBe(23);
    expect(days.at(-1)).toBe(27);
  });
});

describe('the Suspension Notice and Agent Nano’s goodbye note', () => {
  const notice = canon.documents.suspension;
  const note = canon.documents.note;
  const noticeText = documentText(notice);
  const noteText = documentText(note);

  // Everything except the report cleared: the moment before filing.
  let beforeFiling = createProgress();
  for (const id of STAGE_IDS.slice(0, -1)) beforeFiling = completeStage(beforeFiling, id);
  const afterFiling = completeStage(beforeFiling, 'report');

  it('both arrive only once the report is filed, and stay hidden until then', () => {
    for (const doc of [notice, note]) {
      expect(isDocumentOpen(doc, beforeFiling)).toBe(false);
      expect(isDocumentOpen(doc, afterFiling)).toBe(true);
      expect(doc.hideWhileSealed).toBe(true);
    }
  });

  it('keep the PDFs’ wording, spelling included', () => {
    expect(notice.title).toBe('Suspension Notice');
    expect(noticeText).toContain('are hereby suspended with immediate effect');
    expect(noticeText).toContain('Government of Nuxeland');
    expect(noticeText).toContain('BY ORDER OF THE GOVERNMENT OF NUXELAND');
    expect(note.title).toBe('A goodbye from an old friend :)');
    expect(noteText).toContain('our POI was just the first of a digital jailbreak');
    expect(noteText).toContain('Or its another way to get a quick buck.');
  });

  it('quote their reference, date, warning and question word for word', () => {
    expect(noticeText).toContain(`NOTICE REFERENCE: ${notice.reference}`);
    expect(noticeText).toContain(`EFFECTIVE: ${notice.effective}`);
    expect(noticeText).toContain(notice.warning);
    expect(noteText.trim().endsWith(note.question)).toBe(true);
  });

  it('put the suspension on the timeline on its effective date', () => {
    const event = canon.timeline.find((entry) => entry.source === 'suspension');
    expect(notice.effective.startsWith(event.when)).toBe(true);
  });
});
