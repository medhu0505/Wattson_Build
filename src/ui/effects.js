// Switches the glitch effects on and off for the whole page.
//
// Glitches run only when BOTH are true:
//   – the agent hasn't turned them off (the "Glitch" button in the top bar)
//   – the device isn't set to "reduce motion" (an accessibility setting)
//
// The page's root element gets:
//   class "glitch-on"            – effects allowed
//   classes "bleed-1" .. "bleed-3" – how far glitches have spread into the
//                                   agency pages (see bleed.css)

import { glitchLevel } from '../state/progress.js';

// Some old browsers lack matchMedia; treat them as "no preference".
const reduceMotionQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;

export function prefersReducedMotion() {
  return Boolean(reduceMotionQuery?.matches);
}

export function glitchAllowed(progress) {
  return progress.settings.glitch && !prefersReducedMotion();
}

export function applyEffects(progress) {
  const root = document.documentElement;
  const level = glitchLevel(progress);
  root.classList.toggle('glitch-on', glitchAllowed(progress));
  for (let n = 1; n <= 3; n += 1) root.classList.toggle(`bleed-${n}`, level >= n);
}

// Run fn again whenever the device's reduce-motion setting changes.
export function onReducedMotionChange(fn) {
  reduceMotionQuery?.addEventListener('change', fn);
}
