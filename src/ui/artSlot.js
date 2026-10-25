// Art slots: places where the team's own artwork goes.
// The list of slots is in content/assets.json. If the picture file exists in
// /public it is shown; if not, a labelled empty frame is shown instead (or a
// "fallback" element, if one is given), so nothing looks broken.

import assets from '../../content/assets.json';
import { el } from './dom.js';

// Files in /public are served from the site's base address (BASE_URL).
export function assetUrl(file) {
  return `${import.meta.env.BASE_URL}${file}`;
}

export function artSlot(slotId, { fallback = null, className = '' } = {}) {
  const slot = assets.art[slotId];
  const frame = el('figure', { class: `art-slot ${className}`.trim(), 'data-slot': slotId });

  if (!slot) {
    frame.append(el('figcaption', {}, `Unknown art slot: ${slotId}`));
    return frame;
  }

  // What shows until (or unless) the picture loads.
  frame.append(fallback ?? el('figcaption', { class: 'art-slot__label' },
    el('span', {}, 'ART SLOT'),
    el('span', {}, slotId),
    el('span', {}, `public/${slot.file}`)
  ));

  // Try to load the picture. If it's there, swap it in.
  const image = new Image();
  image.alt = slot.alt;
  image.addEventListener('load', () => {
    frame.classList.add('art-slot--filled');
    frame.replaceChildren(image);
  });
  image.src = assetUrl(slot.file);

  return frame;
}
