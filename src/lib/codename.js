// Rules for the codename an agent picks at intake.
// No web page code in here, so the tests can check it directly.

export const CODENAME_MIN = 2;
export const CODENAME_MAX = 24;

// Names already used in the case files. Agents can't take them.
const AGENT_NAMES = ['nano', 'mega'];      // the two undercover agents in Transcript A
const SUSPECT_NAMES = ['poi-1', 'poi1'];   // the person of interest

// Letters and numbers from any alphabet, plus spaces, hyphens, full stops
// and apostrophes. It must start with a letter or a number.
// (\p{L} means "any letter", \p{N} "any number", and \p{M} "a mark joined to
// a letter", such as the vowel signs in Hindi: नैनो needs them.)
const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .'-]*$/u;

// Remove spaces at the ends and squash runs of spaces into one.
export function tidyCodename(raw) {
  return String(raw ?? '').trim().replace(/\s+/g, ' ');
}

// Check a codename. Returns { ok: true, name } or { ok: false, name, error }.
export function checkCodename(raw) {
  const name = tidyCodename(raw);
  const fail = (error) => ({ ok: false, name, error });

  if (name.length === 0) return fail('Enter a codename.');
  if (name.length < CODENAME_MIN) return fail(`A codename needs at least ${CODENAME_MIN} characters.`);
  if (name.length > CODENAME_MAX) return fail(`A codename can be at most ${CODENAME_MAX} characters.`);
  if (!ALLOWED.test(name)) {
    return fail('Use letters, numbers, spaces, hyphens, full stops or apostrophes, starting with a letter or number.');
  }

  const plain = name.toLowerCase().replace(/\s/g, '');
  if (AGENT_NAMES.includes(plain)) return fail(`"${name}" is already assigned to another agent.`);
  if (SUSPECT_NAMES.includes(plain)) return fail('That designation belongs to a person of interest.');

  return { ok: true, name };
}

// Turn a codename into an agent number like "EXN-4F2A-91C0".
// The same codename always gives the same number (so it matches on the
// report), and different codenames almost always give different numbers.
export function agentNumber(name) {
  let hash = 5381;
  for (const character of tidyCodename(name).toUpperCase()) {
    // ">>> 0" keeps the number a whole, positive 32-bit value.
    hash = ((hash * 33) ^ character.codePointAt(0)) >>> 0;
  }
  const hex = hash.toString(16).toUpperCase().padStart(8, '0');
  return `EXN-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}
