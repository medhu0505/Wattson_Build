// Sound. OFF until the agent switches it on (the "Sound" button in the top
// bar). The sound files are the team's own: their slots are listed in
// content/assets.json. A missing file is simply skipped, so the site works
// with no audio at all.

import assets from '../../content/assets.json';
import { assetUrl } from './artSlot.js';

const players = {}; // one <audio> player per slot, made the first time it's needed

let enabled = false;

// Called by main.js whenever the setting changes.
export function setAudioEnabled(on) {
  enabled = on;
  if (!on) stopAll();
}

export function play(slotId) {
  const slot = assets.audio[slotId];
  if (!enabled || !slot) return;
  try {
    players[slotId] ??= new Audio(assetUrl(slot.file));
    const player = players[slotId];
    player.loop = Boolean(slot.loop);
    player.volume = slot.volume ?? 0.6;
    player.currentTime = 0;
    // play() fails if the file is missing or the browser blocks sound: ignore it.
    player.play().catch(() => {});
  } catch {
    // No audio support at all: carry on silently.
  }
}

export function stop(slotId) {
  const player = players[slotId];
  if (player) player.pause();
}

export function stopAll() {
  Object.values(players).forEach((player) => player.pause());
}
