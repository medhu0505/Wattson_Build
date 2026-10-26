// Art slots: places where the team's own artwork goes.
// The list of slots is in content/assets.json. To fill one, put a picture
// with the listed file name into src/assets/art/.
//
// The site finds those files when it is BUILT (import.meta.glob below), so
// it never asks the server for a picture that isn't there.
//   – picture there:    it is shown
//   – picture missing:  a stand-in is shown. While developing (npm run dev)
//                       it's a labelled frame saying which file to add; on the
//                       live site it's a plain in-world "not on file" frame.

import assets from '../../content/assets.json';
import { el } from './dom.js';

// Every picture in src/assets/art/, as { 'agency-mark.png': '<its address>' }.
const ART_FILES = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/art/*.{png,jpg,jpeg,webp,svg,gif}', {
    eager: true, query: '?url', import: 'default',
  })).map(([path, url]) => [path.split('/').pop(), url])
);

// true if the team has added the picture for this slot.
export function hasArt(slotId) {
  const slot = assets.art[slotId];
  return Boolean(slot && ART_FILES[slot.file]);
}

// inline: true makes a <span> that sits inside a line of text (used for
// signatures); otherwise it's a <figure> block.
// fallback: what to show when the picture is missing (optional).
export function artSlot(slotId, { fallback = null, className = '', inline = false } = {}) {
  const slot = assets.art[slotId];
  const frame = el(inline ? 'span' : 'figure', {
    class: `art-slot${inline ? ' art-slot--inline' : ''} ${className}`.trim(),
    'data-slot': slotId,
  });

  if (!slot) {
    frame.append(`Unknown art slot: ${slotId}`);
    return frame;
  }

  if (ART_FILES[slot.file]) {
    frame.classList.add('art-slot--filled');
    frame.append(el('img', { src: ART_FILES[slot.file], alt: slot.alt }));
    return frame;
  }

  if (fallback) {
    frame.append(fallback);
  } else if (import.meta.env.DEV) {
    // Only while developing: say exactly which file to add.
    frame.append(el(inline ? 'span' : 'figcaption', { class: 'art-slot__label' },
      el('span', {}, 'ART SLOT'),
      el('span', {}, slotId),
      el('span', {}, `src/assets/art/${slot.file}`)));
  } else {
    frame.classList.add('art-slot--missing');
    frame.append(el(inline ? 'span' : 'figcaption', { class: 'art-slot__missing' }, slot.missing ?? 'Not on file'));
  }
  return frame;
}
