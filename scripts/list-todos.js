// Lists every TODO-TEAM slot still waiting to be filled, with its file and
// line number. Run it with:   npm run todo
//
// It reads content/story.json (story text), content/assets.json (artwork
// and audio) and README.md (the live link). A slot is any value that starts
// with "TODO-TEAM:". Once you replace a slot's text, it disappears from
// this list.

import { readFileSync } from 'node:fs';

const FILES = ['content/story.json', 'content/assets.json'];

let total = 0;

// README.md: any line with "TODO-TEAM:" in it.
readFileSync(new URL('../README.md', import.meta.url), 'utf8').split(/\r?\n/).forEach((line, index) => {
  const slot = line.match(/TODO-TEAM:\s*(.*)$/);
  if (slot) {
    console.log(`README.md:${index + 1}  live link\n    ${slot[1]}`);
    total += 1;
  }
});

for (const file of FILES) {
  const lines = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split(/\r?\n/);
  const path = []; // the keys we're inside, e.g. ['art', 'marquee']

  lines.forEach((line, index) => {
    // Going into an object:  "intake": {
    const opening = line.match(/^\s*"([\w-]+)":\s*\{\s*$/);
    if (opening) {
      path.push(opening[1]);
      return;
    }
    // Coming out of one:  },
    if (/^\s*\},?\s*$/.test(line)) {
      path.pop();
      return;
    }
    // A slot:  "heading": "TODO-TEAM: what to write here",
    const slot = line.match(/^\s*"([\w-]+)":\s*"TODO-TEAM:\s*(.*)",?\s*$/);
    if (slot) {
      const name = slot[1] === 'todo' ? path.join('.') : [...path, slot[1]].join('.');
      console.log(`${file}:${index + 1}  ${name}\n    ${slot[2]}`);
      total += 1;
    }
  });
}

console.log(`\n${total} TODO-TEAM slot${total === 1 ? '' : 's'} left.`);
