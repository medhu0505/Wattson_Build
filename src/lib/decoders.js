// The signal decoder's tools: Base64, Base32, hex, ASCII codes, Caesar and
// reverse, plus auto-detect, which tries them all and ranks the results.
// No web page code in here, so the tests can check every tool directly.
//
// Every tool returns the same shape:
//   { ok: true,  output: 'decoded text' }
//   { ok: false, error: 'why it could not be decoded' }

const success = (output) => ({ ok: true, output });
const failure = (error) => ({ ok: false, error });
const NOTHING = 'Nothing to work on yet.';

// ---------- Text <-> bytes ----------
// Base64, Base32 and hex all describe BYTES. To show them as text we read
// the bytes as UTF-8 (the usual way text is stored). "fatal" makes it refuse
// bytes that aren't valid text, instead of printing junk.

function bytesToText(bytes) {
  try {
    return success(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return failure('It decodes, but the result is not readable text.');
  }
}

function textToBytes(text) {
  return new TextEncoder().encode(text);
}

// ---------- Shared engine for Base64 and Base32 ----------
// Both work the same way: each character stands for a few bits
// (6 bits in Base64, 5 in Base32). Decoding collects those bits and cuts
// them into 8-bit bytes; encoding does the reverse.

function bitsToBytes(text, alphabet, bitsPerChar) {
  const bytes = [];
  let buffer = 0; // bits collected but not used yet
  let count = 0;  // how many bits are in the buffer
  for (const character of text) {
    buffer = (buffer << bitsPerChar) | alphabet.indexOf(character);
    count += bitsPerChar;
    if (count >= 8) {
      count -= 8;
      bytes.push((buffer >> count) & 0xff); // take the top 8 bits
    }
    buffer &= (1 << count) - 1; // throw away the bits just used
  }
  return Uint8Array.from(bytes);
}

function bytesToChars(bytes, alphabet, bitsPerChar, padBlock) {
  const mask = (1 << bitsPerChar) - 1;
  let output = '';
  let buffer = 0;
  let count = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    count += 8;
    while (count >= bitsPerChar) {
      count -= bitsPerChar;
      output += alphabet[(buffer >> count) & mask];
    }
    buffer &= (1 << count) - 1;
  }
  if (count > 0) output += alphabet[(buffer << (bitsPerChar - count)) & mask]; // leftover bits, padded with 0s
  while (output.length % padBlock !== 0) output += '=';
  return output;
}

// ---------- Base64 ----------

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64Decode(input) {
  let text = String(input ?? '').replace(/\s/g, '');
  if (!text) return failure(NOTHING);
  text = text.replace(/-/g, '+').replace(/_/g, '/'); // "URL-safe" Base64 uses - and _ instead
  text = text.replace(/={1,2}$/, '');                 // padding at the end is optional
  if (/[^A-Za-z0-9+/]/.test(text)) return failure('Base64 only uses A–Z, a–z, 0–9, + and / (with = at the end).');
  if (text.length % 4 === 1) return failure('That is the wrong length for Base64.');
  return bytesToText(bitsToBytes(text, BASE64, 6));
}

export function base64Encode(input) {
  const text = String(input ?? '');
  if (!text) return failure(NOTHING);
  return success(bytesToChars(textToBytes(text), BASE64, 6, 4));
}

// ---------- Base32 ----------

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input) {
  let text = String(input ?? '').replace(/\s/g, '').toUpperCase();
  if (!text) return failure(NOTHING);
  text = text.replace(/={1,6}$/, ''); // padding at the end is optional
  if (/[^A-Z2-7]/.test(text)) return failure('Base32 only uses the letters A–Z and the digits 2–7 (with = at the end).');
  // Groups of 8 characters make 5 bytes; a part-group can only be 2, 4, 5 or 7 characters.
  if ([1, 3, 6].includes(text.length % 8)) return failure('That is the wrong length for Base32.');
  return bytesToText(bitsToBytes(text, BASE32, 5));
}

export function base32Encode(input) {
  const text = String(input ?? '');
  if (!text) return failure(NOTHING);
  return success(bytesToChars(textToBytes(text), BASE32, 5, 8));
}

// ---------- Hex ----------
// Two hex digits (0–9, a–f) per byte. Accepts "626c75", "62 6c 75",
// "62:6c:75" and "0x62 0x6c 0x75".

export function hexDecode(input) {
  const text = String(input ?? '').trim();
  if (!text) return failure(NOTHING);
  const digits = text.replace(/0x/gi, '').replace(/[\s:,-]/g, '');
  if (!digits) return failure(NOTHING); // e.g. just "0x"
  if (/[^0-9a-f]/i.test(digits)) return failure('Hex only uses 0–9 and a–f.');
  if (digits.length % 2 !== 0) return failure('Hex needs an even number of digits (two per byte).');
  const bytes = digits.match(/../g).map((pair) => parseInt(pair, 16));
  return bytesToText(Uint8Array.from(bytes));
}

export function hexEncode(input) {
  const text = String(input ?? '');
  if (!text) return failure(NOTHING);
  return success([...textToBytes(text)].map((byte) => byte.toString(16).padStart(2, '0')).join(' '));
}

// ---------- ASCII codes ----------
// Each character as its ASCII number (0–127): "98 108 117" is "blu".
// Also reads 8-digit binary groups: "01100010 01101100" is "bl".

export function asciiDecode(input) {
  const text = String(input ?? '').trim();
  if (!text) return failure(NOTHING);
  const tokens = text.split(/[\s,]+/);
  const binary = tokens.every((token) => /^[01]{8}$/.test(token));
  if (!binary && tokens.some((token) => !/^\d+$/.test(token))) {
    return failure('ASCII codes are whole numbers separated by spaces or commas.');
  }
  const codes = tokens.map((token) => parseInt(token, binary ? 2 : 10));
  if (codes.some((code) => code > 127)) return failure('ASCII codes only go from 0 to 127.');
  return success(String.fromCharCode(...codes));
}

export function asciiEncode(input) {
  const text = String(input ?? '');
  if (!text) return failure(NOTHING);
  const codes = [...text].map((character) => character.codePointAt(0));
  if (codes.some((code) => code > 127)) return failure('That text has characters that are not ASCII.');
  return success(codes.join(' '));
}

// ---------- Caesar shift ----------
// Moves every letter along the alphabet: shift 1 turns a into b, z into a.
// Capitals stay capitals; anything that isn't a letter is left alone.
// To decode, shift back by the same amount (a negative shift).

export function caesarShift(input, shift) {
  const text = String(input ?? '');
  if (!text) return failure(NOTHING);
  const steps = ((Math.trunc(shift) % 26) + 26) % 26; // e.g. -1 becomes 25, 27 becomes 1
  const output = text.replace(/[a-z]/gi, (letter) => {
    const start = letter <= 'Z' ? 65 : 97; // char code of 'A' or 'a'
    return String.fromCharCode(((letter.charCodeAt(0) - start + steps) % 26) + start);
  });
  return success(output);
}

// Every possible Caesar decode (shifting back 1 to 25).
export function caesarAll(input) {
  return Array.from({ length: 25 }, (_, index) => ({ back: index + 1, ...caesarShift(input, -(index + 1)) }));
}

// ---------- Reverse ----------
// Array.from splits by real characters, so emoji and accented letters
// aren't broken in half.

export function reverseText(input) {
  const text = String(input ?? '');
  if (!text) return failure(NOTHING);
  return success(Array.from(text).reverse().join(''));
}

// ---------- All the tools, by name (the page uses this list) ----------
// options.shift is only used by Caesar.

export const TOOLS = {
  base64: { label: 'Base64', decode: base64Decode, encode: base64Encode },
  base32: { label: 'Base32', decode: base32Decode, encode: base32Encode },
  hex: { label: 'Hex', decode: hexDecode, encode: hexEncode },
  ascii: { label: 'ASCII codes', decode: asciiDecode, encode: asciiEncode },
  caesar: {
    label: 'Caesar',
    decode: (text, { shift = 3 } = {}) => caesarShift(text, -shift),
    encode: (text, { shift = 3 } = {}) => caesarShift(text, shift),
  },
  reverse: { label: 'Reverse', decode: reverseText, encode: reverseText },
};

// ---------- How readable is a piece of text? ----------
// Auto-detect needs to tell "blueshirt" from junk like "A5EXUBNTLZKHWJM".
// The score (0 to 1) rewards text that looks like English: printable
// characters, common letters, a normal share of vowels, and words that
// don't have digits jammed in the middle.

// How common each letter is in English (per cent).
const LETTER_FREQUENCY = {
  e: 12.7, t: 9.1, a: 8.2, o: 7.5, i: 7.0, n: 6.7, s: 6.3, h: 6.1, r: 6.0, d: 4.3,
  l: 4.0, c: 2.8, u: 2.8, m: 2.4, w: 2.4, f: 2.2, g: 2.0, y: 2.0, p: 1.9, b: 1.5,
  v: 1.0, k: 0.8, j: 0.15, x: 0.15, q: 0.1, z: 0.07,
};

export function readability(text) {
  const characters = Array.from(String(text ?? ''));
  if (characters.length === 0) return 0;

  // 1. Printable: ordinary keyboard characters, or letters from any alphabet.
  const printable = characters.filter((c) => /[\x20-\x7E\t\n\r]/.test(c) || /\p{L}/u.test(c)).length
    / characters.length;
  if (printable < 0.95) return printable * 0.2; // mostly unprintable: junk

  const letters = characters.map((c) => c.toLowerCase()).filter((c) => LETTER_FREQUENCY[c] !== undefined);
  if (letters.length === 0) return 0.3 * printable; // numbers and symbols only

  // 2. Common letters score higher than rare ones (about 1 for typical English).
  const averageFrequency = letters.reduce((total, c) => total + LETTER_FREQUENCY[c], 0) / letters.length;
  const commonLetters = Math.min(1, averageFrequency / 8);

  // 3. English is roughly 38% vowels.
  const vowelShare = letters.filter((c) => 'aeiou'.includes(c)).length / letters.length;
  const vowels = Math.max(0, 1 - Math.abs(vowelShare - 0.38) / 0.38);

  // 4. Mostly letters (not digits and symbols).
  const nonSpace = characters.filter((c) => !/\s/.test(c)).length;
  const letterShare = letters.length / nonSpace;

  // 5. Words shouldn't mix letters and digits ("NBUXE5A" is suspicious).
  const words = String(text).split(/\s+/).filter(Boolean);
  const cleanWords = words.filter((word) => !(/[a-z]/i.test(word) && /\d/.test(word))).length / words.length;

  return printable * (0.35 * commonLetters + 0.25 * vowels + 0.2 * letterShare + 0.2 * cleanWords);
}

// ---------- Auto-detect ----------
// Tries every tool's decode (and all 25 Caesar shifts), drops the ones that
// fail or change nothing, and ranks the rest by readability, best first.

export function autoDetect(input, limit = 5) {
  const text = String(input ?? '');
  if (!text.trim()) return [];

  const attempts = [
    { tool: 'base64', label: 'Base64', ...base64Decode(text) },
    { tool: 'base32', label: 'Base32', ...base32Decode(text) },
    { tool: 'hex', label: 'Hex', ...hexDecode(text) },
    { tool: 'ascii', label: 'ASCII codes', ...asciiDecode(text) },
    { tool: 'reverse', label: 'Reverse', ...reverseText(text) },
    ...caesarAll(text).map((attempt) => ({ tool: 'caesar', label: `Caesar, back ${attempt.back}`, shift: attempt.back, ...attempt })),
  ];

  return attempts
    .filter((attempt) => attempt.ok && attempt.output !== text)
    .map((attempt) => ({
      tool: attempt.tool,
      label: attempt.label,
      shift: attempt.shift,
      output: attempt.output,
      score: Math.round(readability(attempt.output) * 100) / 100,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
