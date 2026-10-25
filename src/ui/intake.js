// Stage 00: Intake.
// Step 1: the agent picks a codename and agrees to the oath. Their ID card
//         fills in as they type, and gets stamped when it's issued.
// Step 2: they read the briefing. Accepting it clears the stage and opens
//         the case files.

import '../styles/intake.css';
import { el, announce } from './dom.js';
import { storyLine } from './story.js';
import { artSlot } from './artSlot.js';
import { checkCodename, tidyCodename, agentNumber, CODENAME_MIN, CODENAME_MAX } from '../lib/codename.js';
import { completeStage, isCompleted, currentStageId } from '../state/progress.js';
import { getStage } from '../state/stages.js';

export function renderIntake(main, { store, go }) {
  const layout = el('div', { class: 'intake' });
  main.append(layout);

  // Draw whichever step the agent is on. justIssued = the card was stamped
  // a moment ago, so play the stamp animation once.
  function draw(justIssued = false) {
    const progress = store.get();
    const card = idCard(progress.codename, progress.startedAt, justIssued);
    const sheet = progress.codename
      ? briefingSheet(progress)
      : formSheet(card);
    layout.replaceChildren(sheet, card.element);
  }

  // ---------- Step 1: the intake form ----------

  function formSheet(card) {
    const input = el('input', {
      id: 'codename',
      name: 'codename',
      type: 'text',
      autocomplete: 'off',
      spellcheck: 'false',
      maxlength: String(CODENAME_MAX + 8), // a little slack; checkCodename gives the real message
      'aria-describedby': 'codename-help codename-error',
    });
    const codenameError = el('p', { id: 'codename-error', class: 'field-error' });

    const oath = el('input', { id: 'oath', name: 'oath', type: 'checkbox', 'aria-describedby': 'oath-error' });
    const oathError = el('p', { id: 'oath-error', class: 'field-error' });

    // The ID card copies the codename as it's typed.
    input.addEventListener('input', () => card.preview(tidyCodename(input.value)));

    const form = el('form', { class: 'intake-form', novalidate: true },
      el('div', { class: 'field' },
        el('label', { for: 'codename', class: 'field__label' }, 'Codename'),
        input,
        el('p', { id: 'codename-help', class: 'field__help' },
          `${CODENAME_MIN} to ${CODENAME_MAX} characters. This name goes on your ID card and your case report.`),
        codenameError
      ),
      el('div', { class: 'field field--oath' },
        el('label', { for: 'oath', class: 'oath' }, oath, storyLine('intake.oath')),
        oathError
      ),
      el('button', { class: 'btn', type: 'submit' }, 'Issue credentials')
    );

    form.addEventListener('submit', (event) => {
      event.preventDefault(); // stay on this page; we handle it here
      const check = checkCodename(input.value);

      showError(input, codenameError, check.ok ? '' : check.error);
      showError(oath, oathError, oath.checked ? '' : 'You must agree before credentials can be issued.');

      // Send the keyboard to the first thing that needs fixing.
      if (!check.ok) { input.focus(); return; }
      if (!oath.checked) { oath.focus(); return; }

      store.update((progress) => ({
        ...progress,
        codename: check.name,
        startedAt: progress.startedAt ?? new Date().toISOString(),
      }));
      draw(true);
      announce(`Credentials issued to agent ${check.name}.`);
      focusHeading();
    });

    return el('section', { class: 'sheet intake__sheet' },
      el('p', { class: 'sheet__ref' }, 'Form 00 / Agent intake'),
      el('h1', { class: 'sheet__title' }, storyLine('intake.heading')),
      // Pre-filled lines on the form, taken from the Case Debrief.
      el('dl', { class: 'form-fixed' },
        el('dt', {}, 'Department'), el('dd', {}, 'Extradigital Exceptions and Unknowns Network'),
        el('dt', {}, 'Assignment'), el('dd', {}, 'Case #1, Wenoti Arcade, 92nd Avenue, nuxEland')
      ),
      form
    );
  }

  // ---------- Step 2: the briefing ----------

  function briefingSheet(progress) {
    const done = isCompleted(progress, 'intake');
    const values = { codename: progress.codename };

    const actions = el('div', { class: 'intake__actions' });
    if (!done) {
      actions.append(
        el('button', { class: 'btn', type: 'button', onClick: acceptAssignment }, 'Accept assignment'),
        el('button', { class: 'btn btn--ghost', type: 'button', onClick: amendCodename }, 'Amend codename')
      );
    } else {
      const current = getStage(currentStageId(progress));
      actions.append(
        el('button', { class: 'btn', type: 'button', onClick: () => go(current.id) },
          `Continue to folder ${current.tab}: ${current.title}`),
        startOverControl()
      );
    }

    return el('section', { class: 'sheet intake__sheet' },
      el('p', { class: 'sheet__ref' }, 'Folder 00 / Briefing'),
      el('h1', { class: 'sheet__title' }, 'Briefing'),
      storyLine('intake.welcome', values, 'p'),
      el('div', { class: 'memo intake__memo' },
        el('p', {}, `To: Agent ${progress.codename}`),
        el('p', {}, 'From: ', storyLine('intake.briefingFrom')),
        el('p', {}, 'Re: Case #1, Wenoti Arcade')
      ),
      storyLine('intake.briefing1', values, 'p'),
      storyLine('intake.briefing2', values, 'p'),
      storyLine('intake.briefing3', values, 'p'),
      actions
    );
  }

  function acceptAssignment() {
    store.update((progress) => completeStage(progress, 'intake'));
    announce('Assignment accepted. Folder 01, Case Files, is now open.');
    go('files');
  }

  // Go back to the form, keeping the start time.
  function amendCodename() {
    store.update((progress) => ({ ...progress, codename: '' }));
    draw();
    focusHeading();
    document.getElementById('codename')?.focus();
  }

  // "Start over" asks twice, so nobody wipes their progress by accident.
  function startOverControl() {
    const box = el('div', { class: 'start-over' });

    const ask = el('button', { class: 'btn btn--ghost', type: 'button', onClick: showConfirm }, 'Start the case over');

    function showConfirm() {
      const yes = el('button', { class: 'btn btn--danger', type: 'button', onClick: wipe }, 'Erase my progress');
      const no = el('button', { class: 'btn btn--ghost', type: 'button', onClick: cancel }, 'Keep it');
      box.replaceChildren(
        el('p', { class: 'start-over__warning' }, 'This erases your codename, pinned evidence and every cleared folder.'),
        yes, no
      );
      no.focus(); // the safe choice gets the keyboard, so a stray Enter erases nothing
    }
    function cancel() {
      box.replaceChildren(ask);
      ask.focus();
    }
    function wipe() {
      store.reset();
      announce('Progress erased. The case starts again from intake.');
      go('intake');
    }

    box.append(ask);
    return box;
  }

  function focusHeading() {
    const heading = layout.querySelector('h1');
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }

  draw();
}

// Show or clear the error message under a form field.
function showError(field, messageBox, message) {
  messageBox.textContent = message;
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
}

// ---------- The agent ID card ----------
// Returns { element, preview(name) }. preview() updates the card while the
// agent is still typing.

function idCard(codename, startedAt, justIssued) {
  const issued = Boolean(codename);
  const nameValue = el('dd', { class: 'idcard__name' });
  const numberValue = el('dd', {});

  function preview(name) {
    nameValue.textContent = name || '—';
    numberValue.textContent = name ? agentNumber(name) : '—';
  }
  preview(codename);

  const element = el('aside', { class: `idcard${issued ? ' idcard--issued' : ''}`, 'aria-label': 'Agent ID card' },
    el('div', { class: 'idcard__band' },
      el('span', { class: 'idcard__agency' }, 'EXUN'),
      el('span', { class: 'idcard__unit' }, 'Extradigital Exceptions and Unknowns Network')
    ),
    el('div', { class: 'idcard__body' },
      artSlot('id-photo', { className: 'idcard__photo' }),
      el('dl', { class: 'idcard__details' },
        el('dt', {}, 'Codename'), nameValue,
        el('dt', {}, 'Agent no.'), numberValue,
        el('dt', {}, 'Issued'), el('dd', {}, formatDate(startedAt ?? new Date().toISOString())),
        el('dt', {}, 'Assignment'), el('dd', {}, 'Case #1')
      )
    ),
    issued && el('p', { class: `stamp idcard__stamp${justIssued ? ' idcard__stamp--new' : ''}` }, 'Admitted')
  );

  return { element, preview };
}

// '2026-10-25T10:00:00.000Z' -> '25 OCT 2026'
function formatDate(isoText) {
  return new Date(isoText)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}
