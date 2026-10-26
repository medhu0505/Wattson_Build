// A line-by-line "diff": which lines were removed from one text, which were
// added, and which stayed the same. Used to compare the arcade game's
// original code with the source code obtained on 24 October (Agent Nano's log).
//
// How it works: find the longest list of lines both texts share, in order
// (the "longest common subsequence"). Every line that isn't part of that
// shared list was either removed (only in the old text) or added (only in
// the new text).

// Split text into lines. Windows line endings (\r\n) count the same as \n,
// and one final line break at the end is ignored.
export function splitLines(text) {
  const normal = String(text ?? '').replace(/\r\n?/g, '\n');
  if (normal === '') return [];
  return normal.replace(/\n$/, '').split('\n');
}

// Returns a list like:
//   { type: 'same',    text, oldLine: 3, newLine: 3 }
//   { type: 'removed', text, oldLine: 4, newLine: null }
//   { type: 'added',   text, oldLine: null, newLine: 5 }
export function diffLines(oldText, newText) {
  const a = splitLines(oldText);
  const b = splitLines(newText);

  // shared[i][j] = how many lines a (from line i on) and b (from line j on)
  // can share in order. Filled in from the bottom up.
  const shared = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      shared[i][j] = a[i] === b[j] ? shared[i + 1][j + 1] + 1 : Math.max(shared[i + 1][j], shared[i][j + 1]);
    }
  }

  // Walk through both texts, following the table.
  const result = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push({ type: 'same', text: a[i], oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
    } else if (shared[i + 1][j] >= shared[i][j + 1]) {
      result.push({ type: 'removed', text: a[i], oldLine: i + 1, newLine: null });
      i += 1;
    } else {
      result.push({ type: 'added', text: b[j], oldLine: null, newLine: j + 1 });
      j += 1;
    }
  }
  for (; i < a.length; i += 1) result.push({ type: 'removed', text: a[i], oldLine: i + 1, newLine: null });
  for (; j < b.length; j += 1) result.push({ type: 'added', text: b[j], oldLine: null, newLine: j + 1 });
  return result;
}

// Counts of each kind of line.
export function diffSummary(lines) {
  return {
    removed: lines.filter((line) => line.type === 'removed').length,
    added: lines.filter((line) => line.type === 'added').length,
    same: lines.filter((line) => line.type === 'same').length,
  };
}

// Keep the changed lines plus a few unchanged lines around each change;
// replace long unchanged stretches with { type: 'skip', count }.
export function withContext(lines, context = 2) {
  const nearChange = lines.map((_, index) =>
    lines.slice(Math.max(0, index - context), index + context + 1).some((line) => line.type !== 'same'));

  const result = [];
  let skipped = 0;
  lines.forEach((line, index) => {
    if (nearChange[index]) {
      if (skipped > 0) result.push({ type: 'skip', count: skipped });
      skipped = 0;
      result.push(line);
    } else {
      skipped += 1;
    }
  });
  if (skipped > 0) result.push({ type: 'skip', count: skipped });
  return result;
}
