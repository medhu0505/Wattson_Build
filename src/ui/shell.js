// The parts of the page that stay put on every screen: the dark case strip
// along the top and the row of folder tabs, one tab per stage.

import { el } from './dom.js';
import { artSlot } from './artSlot.js';
import { STAGES } from '../state/stages.js';
import { isUnlocked, isCompleted } from '../state/progress.js';

export function renderShell(progress, activeId) {
  renderStrip(progress);
  renderTabs(progress, activeId);
}

function renderStrip(progress) {
  const strip = document.getElementById('case-strip');

  // Until the team adds their artwork, the mark is set in type.
  const typedMark = el('span', { class: 'mark' },
    el('span', { class: 'mark__word' }, 'EXUN'),
    el('span', { class: 'mark__year' }, '2026')
  );

  strip.replaceChildren(
    artSlot('agency-mark', { fallback: typedMark, className: 'strip__mark' }),
    el('p', { class: 'strip__case' },
      el('span', { class: 'strip__label' }, 'Case #1'),
      ' Wenoti Arcade, 92nd Avenue'
    ),
    el('p', { class: 'strip__agent' },
      el('span', { class: 'strip__label' }, 'Agent'),
      ' ', progress.codename || 'unassigned'
    )
  );
}

function renderTabs(progress, activeId) {
  const nav = document.getElementById('file-tabs');
  const list = el('ol', { class: 'tabs' });

  for (const stage of STAGES) {
    const locked = !isUnlocked(progress, stage.id);
    const cleared = isCompleted(progress, stage.id);
    const active = stage.id === activeId;

    const classes = ['tab'];
    if (locked) classes.push('tab--locked');
    if (cleared) classes.push('tab--cleared');
    if (active) classes.push('tab--active');

    list.append(
      el('li', {},
        el('a', { class: classes.join(' '), href: `#/${stage.id}`, 'aria-current': active ? 'page' : null },
          el('span', { class: 'tab__no' }, stage.tab),
          el('span', { class: 'tab__title' }, stage.title),
          // Status word: shown as a tiny stamp, and read out by screen readers.
          locked && el('span', { class: 'tab__status' }, 'sealed'),
          cleared && el('span', { class: 'tab__status tab__status--cleared' }, 'cleared')
        )
      )
    );
  }

  nav.replaceChildren(list);
}
