// Tests for every decoder tool, including the awkward inputs people
// actually type. The RFC 4648 lines are the official Base64/Base32 examples.

import { describe, it, expect } from 'vitest';
import {
  base64Decode, base64Encode, base32Decode, base32Encode, hexDecode, hexEncode,
  asciiDecode, asciiEncode, caesarShift, caesarAll, reverseText, readability, autoDetect, TOOLS,
} from '../src/lib/decoders.js';

const output = (result) => (result.ok ? result.output : `ERROR: ${result.error}`);

// The official examples from RFC 4648 (the Base64/Base32 standard).
const RFC = [
  ['f', 'Zg==', 'MY======'],
  ['fo', 'Zm8=', 'MZXQ===='],
  ['foo', 'Zm9v', 'MZXW6==='],
  ['foob', 'Zm9vYg==', 'MZXW6YQ='],
  ['fooba', 'Zm9vYmE=', 'MZXW6YTB'],
  ['foobar', 'Zm9vYmFy', 'MZXW6YTBOI======'],
];

describe('Base32', () => {
  it('decodes the Machine ID, which has no padding', () => {
    expect(output(base32Decode('MJWHKZLTNBUXE5A'))).toBe('blueshirt');
  });

  it('decodes the same with padding, in lower case, or with spaces', () => {
    expect(output(base32Decode('MJWHKZLTNBUXE5A='))).toBe('blueshirt');
    expect(output(base32Decode('mjwhkzltnbuxe5a'))).toBe('blueshirt');
    expect(output(base32Decode(' MJWH KZLT\nNBUX E5A '))).toBe('blueshirt');
  });

  it('matches the RFC 4648 examples both ways', () => {
    for (const [plain, , b32] of RFC) {
      expect(output(base32Encode(plain))).toBe(b32);
      expect(output(base32Decode(b32))).toBe(plain);
    }
  });

  it('rejects characters outside the Base32 alphabet (0, 1, 8, 9, symbols)', () => {
    expect(base32Decode('MJWH1ZLT').ok).toBe(false);
    expect(base32Decode('MJWH8ZLT').error).toMatch(/A–Z/);
    expect(base32Decode('MJ@HKZLT').ok).toBe(false);
  });

  it('rejects lengths that Base32 can never produce', () => {
    expect(base32Decode('MJWHKZLTN').error).toMatch(/wrong length/); // 9 characters
    expect(base32Decode('M').ok).toBe(false);
  });

  it('rejects padding in the middle', () => {
    expect(base32Decode('MZ=XW6===').ok).toBe(false);
  });

  it('round-trips text with accents and symbols', () => {
    const text = 'Wenoti Arcade — café ✓';
    expect(output(base32Decode(output(base32Encode(text))))).toBe(text);
  });
});

describe('Base64', () => {
  it('matches the RFC 4648 examples both ways', () => {
    for (const [plain, b64] of RFC) {
      expect(output(base64Encode(plain))).toBe(b64);
      expect(output(base64Decode(b64))).toBe(plain);
    }
  });

  it('decodes without padding', () => {
    expect(output(base64Decode('Zm9vYg'))).toBe('foob');
    expect(output(base64Decode('Ymx1ZXNoaXJ0'))).toBe('blueshirt');
  });

  it('decodes URL-safe Base64 (- and _ instead of + and /)', () => {
    expect(output(base64Encode('?>>'))).toBe('Pz4+');
    expect(output(base64Decode('Pz4-'))).toBe('?>>');
  });

  it('ignores spaces and line breaks', () => {
    expect(output(base64Decode('Zm9v\nYmFy'))).toBe('foobar');
  });

  it('decodes UTF-8 text such as accents', () => {
    expect(output(base64Decode('Y2Fmw6k='))).toBe('café');
  });

  it('rejects bad characters, bad length, and padding in the middle', () => {
    expect(base64Decode('Zm9v!').ok).toBe(false);
    expect(base64Decode('Zm9vY').error).toMatch(/wrong length/);
    expect(base64Decode('Zm=v').ok).toBe(false);
  });

  it('says so when the bytes are not text', () => {
    expect(base64Decode('/w==').error).toMatch(/not readable text/); // the single byte 0xFF
  });
});

describe('Hex', () => {
  it('decodes plain, spaced, colon and 0x styles', () => {
    expect(output(hexDecode('626c75657368697274'))).toBe('blueshirt');
    expect(output(hexDecode('62 6C 75'))).toBe('blu');
    expect(output(hexDecode('62:6c:75'))).toBe('blu');
    expect(output(hexDecode('0x62 0x6c'))).toBe('bl');
  });

  it('encodes as spaced pairs', () => {
    expect(output(hexEncode('hi'))).toBe('68 69');
    expect(output(hexDecode(output(hexEncode('café'))))).toBe('café');
  });

  it('rejects an odd number of digits and non-hex letters', () => {
    expect(hexDecode('626').error).toMatch(/even number/);
    expect(hexDecode('zz').error).toMatch(/0–9 and a–f/);
    expect(hexDecode('0x').ok).toBe(false);
  });
});

describe('ASCII codes', () => {
  it('decodes numbers separated by spaces or commas', () => {
    expect(output(asciiDecode('98 108 117 101'))).toBe('blue');
    expect(output(asciiDecode('98,108, 117'))).toBe('blu');
  });

  it('decodes 8-digit binary groups', () => {
    expect(output(asciiDecode('01100010 01101100'))).toBe('bl');
  });

  it('encodes text as codes', () => {
    expect(output(asciiEncode('hi'))).toBe('104 105');
  });

  it('rejects numbers above 127, words, and non-ASCII text', () => {
    expect(asciiDecode('98 200').error).toMatch(/0 to 127/);
    expect(asciiDecode('98 abc').ok).toBe(false);
    expect(asciiEncode('café').ok).toBe(false);
  });
});

describe('Caesar', () => {
  it('shifts letters along the alphabet, wrapping round at z', () => {
    expect(output(caesarShift('abc', 1))).toBe('bcd');
    expect(output(caesarShift('xyz', 3))).toBe('abc');
  });

  it('keeps capitals and leaves punctuation and digits alone', () => {
    expect(output(caesarShift('Hello, World! 42', 13))).toBe('Uryyb, Jbeyq! 42');
  });

  it('handles negative shifts and shifts of 26 or more', () => {
    expect(output(caesarShift('bcd', -1))).toBe('abc');
    expect(output(caesarShift('abc', 26))).toBe('abc');
    expect(output(caesarShift('abc', 27))).toBe('bcd');
  });

  it('decodes what it encodes (through the TOOLS list)', () => {
    const secret = output(TOOLS.caesar.encode('blueshirt', { shift: 5 }));
    expect(output(TOOLS.caesar.decode(secret, { shift: 5 }))).toBe('blueshirt');
  });

  it('lists all 25 possible decodes', () => {
    const all = caesarAll('eoxhvkluw');
    expect(all).toHaveLength(25);
    expect(all.find((attempt) => attempt.output === 'blueshirt').back).toBe(3);
  });
});

describe('Reverse', () => {
  it('reverses text', () => {
    expect(output(reverseText('blueshirt'))).toBe('trihseulb');
  });

  it('does not break emoji in half', () => {
    expect(output(reverseText('a😀b'))).toBe('b😀a');
  });
});

describe('empty input', () => {
  it('every tool says there is nothing to work on', () => {
    for (const tool of Object.values(TOOLS)) {
      expect(tool.decode('').ok).toBe(false);
      expect(tool.encode('').ok).toBe(false);
    }
    expect(base64Decode('   ').ok).toBe(false);
    expect(base32Decode(null).ok).toBe(false);
  });
});

describe('readability score', () => {
  it('scores English above scrambled letters, and both above junk', () => {
    const english = readability('blueshirt');
    const scrambled = readability('A5EXUBNTLZKHWJM');
    const junk = readability('\u0001\u0002\u0003xyz');
    expect(english).toBeGreaterThan(scrambled);
    expect(scrambled).toBeGreaterThan(junk);
  });

  it('gives empty text a score of 0', () => {
    expect(readability('')).toBe(0);
  });
});

describe('auto-detect', () => {
  const best = (input) => autoDetect(input)[0];

  it('identifies the Machine ID as Base32 for "blueshirt"', () => {
    expect(best('MJWHKZLTNBUXE5A')).toMatchObject({ tool: 'base32', output: 'blueshirt' });
  });

  it('identifies each of the other encodings of "blueshirt"', () => {
    expect(best('Ymx1ZXNoaXJ0')).toMatchObject({ tool: 'base64', output: 'blueshirt' });
    expect(best('62 6c 75 65 73 68 69 72 74')).toMatchObject({ tool: 'hex', output: 'blueshirt' });
    expect(best('98 108 117 101 115 104 105 114 116')).toMatchObject({ tool: 'ascii', output: 'blueshirt' });
    expect(best('trihseulb')).toMatchObject({ tool: 'reverse', output: 'blueshirt' });
    expect(best('eoxhvkluw')).toMatchObject({ tool: 'caesar', shift: 3, output: 'blueshirt' });
  });

  it('works on whole sentences too', () => {
    const secret = output(base64Encode('meet me at the arcade'));
    expect(best(secret).output).toBe('meet me at the arcade');
  });

  it('ranks best first and returns at most the number asked for', () => {
    const results = autoDetect('MJWHKZLTNBUXE5A', 3);
    expect(results).toHaveLength(3);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
  });

  it('returns nothing for empty input', () => {
    expect(autoDetect('')).toEqual([]);
    expect(autoDetect('   ')).toEqual([]);
  });

  it('never offers a "decode" that changes nothing', () => {
    for (const result of autoDetect('racecar')) expect(result.output).not.toBe('racecar');
  });
});
