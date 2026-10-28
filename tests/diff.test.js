// Tests for the line diff and for reading the arcade game's code.
// The real files are read straight from case-files/.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { diffLines, diffSummary, splitLines, withContext } from '../src/lib/diff.js';
import { definedClasses, missingClasses, readGameSetup, renderWorld } from '../src/lib/arcade.js';

const original = readFileSync(new URL('../case-files/OriginalCode.txt', import.meta.url), 'utf8');
const altered = readFileSync(new URL('../case-files/AlteredCode.txt', import.meta.url), 'utf8');

describe('splitting lines', () => {
  it('treats Windows and Unix line endings the same', () => {
    expect(splitLines('a\r\nb\r\n')).toEqual(['a', 'b']);
    expect(splitLines('a\nb\n')).toEqual(['a', 'b']);
  });

  it('gives no lines for empty text, and keeps blank lines in the middle', () => {
    expect(splitLines('')).toEqual([]);
    expect(splitLines('a\n\nb')).toEqual(['a', '', 'b']);
  });
});

describe('diff basics', () => {
  it('finds nothing changed in identical text', () => {
    expect(diffSummary(diffLines('a\nb\nc', 'a\nb\nc'))).toEqual({ removed: 0, added: 0, same: 3 });
  });

  it('ignores a change of line endings only', () => {
    expect(diffSummary(diffLines('a\r\nb', 'a\nb')).same).toBe(2);
  });

  it('reports everything added when the old text is empty, and removed when the new one is', () => {
    expect(diffSummary(diffLines('', 'a\nb'))).toEqual({ removed: 0, added: 2, same: 0 });
    expect(diffSummary(diffLines('a\nb', ''))).toEqual({ removed: 2, added: 0, same: 0 });
  });

  it('shows a changed line as one removed and one added', () => {
    const lines = diffLines('a\nb\nc', 'a\nB\nc');
    expect(lines.map((line) => line.type)).toEqual(['same', 'removed', 'added', 'same']);
    expect(lines[1]).toMatchObject({ text: 'b', oldLine: 2 });
    expect(lines[2]).toMatchObject({ text: 'B', newLine: 2 });
  });

  it('shortens long unchanged stretches but keeps lines near a change', () => {
    const old = ['1', '2', '3', '4', '5', '6', '7', '8'].join('\n');
    const changed = ['1', '2', '3', '4', 'X', '6', '7', '8'].join('\n');
    const shown = withContext(diffLines(old, changed), 1);
    expect(shown.map((line) => line.type)).toEqual(['skip', 'same', 'removed', 'added', 'same', 'skip']);
    expect(shown[0].count).toBe(3);
    expect(shown[5].count).toBe(2);
  });
});

describe('the arcade code: original vs altered', () => {
  const lines = diffLines(original, altered);

  it('only removes lines: 17 gone, none added', () => {
    expect(diffSummary(lines)).toMatchObject({ removed: 17, added: 0 });
  });

  it('removes original lines 4 to 20, the whole Character class', () => {
    const removed = lines.filter((line) => line.type === 'removed');
    expect(removed[0]).toMatchObject({ oldLine: 4, text: 'class Character {' });
    expect(removed.at(-1).oldLine).toBe(20);
    expect(removed.map((line) => line.oldLine)).toEqual(Array.from({ length: 17 }, (_, i) => i + 4));
  });

  it('knows which classes each version defines', () => {
    expect(definedClasses(original).map((c) => c.name)).toEqual(['Character', 'World', 'Game']);
    expect(definedClasses(altered).map((c) => c.name)).toEqual(['World', 'Game']);
  });

  it('finds Character missing, though the altered code still uses it (lines 9 and 74)', () => {
    expect(missingClasses(original, altered)).toEqual([
      { name: 'Character', line: 4, stillUsedAt: [9, 74] },
    ]);
  });

  it('finds nothing missing when comparing a file with itself', () => {
    expect(missingClasses(original, original)).toEqual([]);
  });
});

describe('the game world', () => {
  const setup = readGameSetup(original);

  it('reads the world size, start position and symbols from the code', () => {
    expect(setup).toEqual({
      width: 24, height: 12, start: { x: 12, y: 6 }, playerSymbol: '@', groundSymbol: '.',
    });
    expect(readGameSetup(altered)).toEqual(setup); // the Game constructor itself was not changed
  });

  it('draws the world with the player at (12, 6)', () => {
    const rows = renderWorld(setup, setup.start);
    expect(rows).toHaveLength(12);
    expect(rows.every((row) => row.length === 24)).toBe(true);
    expect(rows[6][12]).toBe('@');
    expect(rows.join('').split('@')).toHaveLength(2); // exactly one @
  });

  it('draws an empty world when there is no player', () => {
    expect(renderWorld(setup, null).join('')).not.toContain('@');
  });

  it('returns null for code without a game in it', () => {
    expect(readGameSetup('int main() { return 0; }')).toBeNull();
  });
});
