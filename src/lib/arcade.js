// Reads facts out of the arcade game's C++ code (OriginalCode.txt and
// AlteredCode.txt). Everything shown about the game in the terminal comes
// from here, worked out from the code itself.

import { splitLines } from './diff.js';

// Every class the code defines: [{ name: 'World', line: 21 }, ...]
export function definedClasses(code) {
  const classes = [];
  splitLines(code).forEach((text, index) => {
    const match = text.match(/^\s*class\s+(\w+)/);
    if (match) classes.push({ name: match[1], line: index + 1 });
  });
  return classes;
}

// Classes the original defines but the altered code doesn't, and the lines
// of the altered code that still mention them (code that now points at
// something that isn't there).
export function missingClasses(originalCode, alteredCode) {
  const stillDefined = new Set(definedClasses(alteredCode).map((c) => c.name));
  const alteredLines = splitLines(alteredCode);

  return definedClasses(originalCode)
    .filter((c) => !stillDefined.has(c.name))
    .map((c) => ({
      ...c,
      stillUsedAt: alteredLines
        .map((text, index) => (new RegExp(`\\b${c.name}\\b`).test(text) ? index + 1 : null))
        .filter((line) => line !== null),
    }));
}

// The game's set-up, from the Game constructor and World::render:
//   world_(24, 12), character_(12, 6)      -> a 24 x 12 world, player at (12, 6)
//   ? '@' : '.'                            -> the player is drawn as @, empty ground as .
// Returns null if the code doesn't contain them.
export function readGameSetup(code) {
  const sizes = String(code).match(/world_\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*,\s*character_\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  const symbols = String(code).match(/\?\s*'(.)'\s*:\s*'(.)'/);
  if (!sizes || !symbols) return null;
  return {
    width: Number(sizes[1]),
    height: Number(sizes[2]),
    start: { x: Number(sizes[3]), y: Number(sizes[4]) },
    playerSymbol: symbols[1],
    groundSymbol: symbols[2],
  };
}

// Draw the world the way World::render does: one row per line, the player
// symbol where the character stands, ground everywhere else. Pass
// player = null for a world with no character in it.
export function renderWorld({ width, height, playerSymbol, groundSymbol }, player) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    let row = '';
    for (let x = 0; x < width; x += 1) {
      row += player && x === player.x && y === player.y ? playerSymbol : groundSymbol;
    }
    rows.push(row);
  }
  return rows;
}
