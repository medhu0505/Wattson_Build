// The parts of the page that stay put on every screen: the dark case strip
// along the top (with the Hints, Glitch and Sound buttons, and the
// supervisor bar in ?supervisor=1 mode) and the row of folder tabs.

import { el } from './dom.js';
import { artSlot } from './artSlot.js';
import { STAGES } from '../state/stages.js';
import { isUnlocked, isCompleted } from '../state/progress.js';
import { hintsUsed, HINTS_PER_STAGE } from '../lib/hints.js';
import { prefersReducedMotion } from './effects.js';

// controls (from main.js):
//   toggleGlitch(), toggleAudio(), openHints(stageId),
//   markAllCleared(), resetSupervisor(), exitSupervisorHref
export function renderShell(progress, activeId, controls) {
  renderStrip(progress, activeId, controls);
  renderTabs(progress, activeId);
}

function renderStrip(progress, activeId, controls) {
  const strip = document.getElementById('case-strip');
  // Redrawing replaces the buttons, so remember which one had the keyboard.
  const focusedSetting = document.activeElement?.dataset?.setting;

  // Until the team adds their artwork, the mark is set in type.
  const typedMark = el('span', { class: 'mark' },
    el('span', { class: 'mark__word' }, 'EXUN'),
    el('span', { class: 'mark__year' }, '2026')
  );

  // filter(Boolean) drops the supervisor bar when it's "false": unlike el(),
  // replaceChildren would print it as the word "false".
  strip.replaceChildren(...[
    artSlot('agency-mark', { fallback: typedMark, className: 'strip__mark' }),
    el('p', { class: 'strip__case' },
      el('span', { class: 'strip__label' }, 'Case #1'),
      ' Wenoti Arcade, 92nd Avenue'
    ),
    el('p', { class: 'strip__agent' },
      el('span', { class: 'strip__label' }, 'Agent'),
      ' ', progress.codename || 'unassigned'
    ),
    settingsSwitches(progress, activeId, controls),
    progress.supervisor && supervisorBar(controls),
  ].filter(Boolean));

  if (focusedSetting) strip.querySelector(`[data-setting="${focusedSetting}"]`)?.focus();
}

// The Hints button, then two on/off switches. aria-pressed tells screen
// readers whether each switch is on.
function settingsSwitches(progress, activeId, controls) {
  const reduced = prefersReducedMotion();
  const glitchOn = progress.settings.glitch && !reduced;
  const audioOn = progress.settings.audio;
  const used = activeId ? hintsUsed(progress, activeId) : 0;

  return el('div', { class: 'strip__settings', role: 'group', 'aria-label': 'Hints and display settings' },
    activeId && el('button', {
      class: 'switch switch--hints',
      type: 'button',
      'data-setting': 'hints',
      'aria-haspopup': 'dialog',
      onClick: () => controls.openHints(activeId),
    }, 'Hints ', el('span', { class: 'switch__state' }, `${used}/${HINTS_PER_STAGE}`)),
    el('button', {
      class: 'switch',
      type: 'button',
      'data-setting': 'glitch',
      'aria-pressed': String(glitchOn),
      // With "reduce motion" switched on in the device settings, glitches stay off.
      disabled: reduced,
      title: reduced ? 'Off because your device asks for reduced motion' : null,
      onClick: controls.toggleGlitch,
    }, 'Glitch ', el('span', { class: 'switch__state' }, glitchOn ? 'on' : 'off')),
    el('button', {
      class: 'switch',
      type: 'button',
      'data-setting': 'audio',
      'aria-pressed': String(audioOn),
      onClick: controls.toggleAudio,
    }, 'Sound ', el('span', { class: 'switch__state' }, audioOn ? 'on' : 'off'))
  );
}

// Shown only in supervisor mode (?supervisor=1), for judges.
function supervisorBar(controls) {
  return el('div', { class: 'supervisor-bar', role: 'region', 'aria-label': 'Supervisor mode' },
    el('span', { class: 'supervisor-bar__label' }, 'Supervisor access'),
    el('span', { class: 'supervisor-bar__note' },
      'Every folder is open. This session is saved apart from the agent’s own progress.'),
    el('button', { class: 'switch', type: 'button', 'data-setting': 'mark-all', onClick: controls.markAllCleared },
      'Mark every folder cleared'),
    el('button', { class: 'switch', type: 'button', 'data-setting': 'reset-supervisor', onClick: controls.resetSupervisor },
      'Reset this session'),
    el('a', { class: 'switch', href: controls.exitSupervisorHref() }, 'Leave supervisor mode'));
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
