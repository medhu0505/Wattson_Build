// Sound. OFF until the agent switches it on (the "Sound" button in the top
// bar). The sounds are the team's own: their slots are listed in
// content/assets.json. To fill one, put a file with the listed name into
// src/assets/audio/.
//
// Like the artwork, the files are found when the site is built. If there are
// no sound files at all, the Sound button isn't shown, so there's never a
// switch that does nothing.

import assets from '../../content/assets.json';

// Every sound in src/assets/audio/, as { 'crt-hum.mp3': '<its address>' }.
const AUDIO_FILES = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/audio/*.{mp3,ogg,wav,m4a}', {
    eager: true, query: '?url', import: 'default',
  })).map(([path, url]) => [path.split('/').pop(), url])
);

// true if the team has added at least one sound.
export function hasAudio() {
  return Object.values(assets.audio).some((slot) => AUDIO_FILES[slot.file]);
}

const players = {}; // one <audio> player per slot, made the first time it's needed

let enabled = false;

// Called by main.js whenever the setting changes.
export function setAudioEnabled(on) {
  enabled = on;
  if (!on) stopAll();
}

export function play(slotId) {
  const slot = assets.audio[slotId];
  const url = slot && AUDIO_FILES[slot.file];
  if (!enabled || !url) return; // off, or this sound hasn't been added
  try {
    players[slotId] ??= new Audio(url);
    const player = players[slotId];
    player.loop = Boolean(slot.loop);
    player.volume = slot.volume ?? 0.6;
    player.currentTime = 0;
    // play() fails if the browser blocks sound: ignore it.
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
