// The credits tag at the bottom of every page: who made the site.
// The names come from content/team.json.

import team from '../../content/team.json';
import { el } from './dom.js';

// "Medhansh Sharma, Aryaveer Dalal and Mudit Shakya"
export function memberList(members = team.members) {
  if (members.length <= 1) return members.join('');
  return `${members.slice(0, -1).join(', ')} and ${members.at(-1)}`;
}

export function renderColophon() {
  const footer = document.getElementById('colophon');
  footer.replaceChildren(
    el('div', { class: 'colophon__tag' },
      el('p', { class: 'colophon__label' }, `${team.event} · EXUN Case Terminal`),
      el('p', { class: 'colophon__made' }, 'Made by Team ', el('strong', {}, team.team)),
      el('p', { class: 'colophon__names' }, memberList()))
  );
}
