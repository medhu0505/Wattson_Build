// The cabinet only opens for the decoded Machine ID.
// The key is never written down: it is worked out by decoding the Machine ID
// from the Case Debrief (content/canon.json), which is Base32.

import { base32Decode } from './decoders.js';

// The key the cabinet expects, or null if the Machine ID can't be decoded.
export function expectedKey(machineId) {
  const result = base32Decode(machineId);
  return result.ok ? result.output : null;
}

// Check what the agent typed. Spaces at the ends and capital letters don't
// matter. Returns { ok: true, key } or { ok: false, error }.
export function checkAccessKey(entered, machineId) {
  const key = expectedKey(machineId);
  const tidy = String(entered ?? '').trim().toLowerCase();

  if (!tidy) return { ok: false, error: 'Enter the decoded access key.' };
  if (tidy === machineId.toLowerCase()) {
    return { ok: false, error: 'That is the Machine ID as printed. It needs decoding first.' };
  }
  if (key === null || tidy !== key.toLowerCase()) {
    return { ok: false, error: 'The cabinet rejects that key.' };
  }
  return { ok: true, key };
}
