//todofile
import { readFileSync } from 'node:fs';

const FILES = ['content/story.json', 'content/assets.json'];

let total = 0;

// README.md
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
