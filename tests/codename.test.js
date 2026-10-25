// Tests for the codename rules and the story text helpers.

import { describe, it, expect } from 'vitest';
import { checkCodename, tidyCodename, agentNumber, CODENAME_MAX } from '../src/lib/codename.js';
import { isTodo, fillTemplate, getPath } from '../src/lib/text.js';

describe('codename rules', () => {
  it('accepts an ordinary codename', () => {
    expect(checkCodename('Kestrel')).toEqual({ ok: true, name: 'Kestrel' });
  });

  it('tidies spaces before checking', () => {
    expect(tidyCodename('   Night   Owl  ')).toBe('Night Owl');
    expect(checkCodename('   Night   Owl  ').name).toBe('Night Owl');
  });

  it('accepts hyphens, full stops, apostrophes, numbers and other alphabets', () => {
    for (const name of ['Agent-7', 'J.R.', "O'Hara", '404', 'Zoë', 'नैनो']) {
      expect(checkCodename(name).ok).toBe(true);
    }
  });

  it('rejects an empty codename', () => {
    expect(checkCodename('').ok).toBe(false);
    expect(checkCodename('     ').error).toMatch(/enter a codename/i);
    expect(checkCodename(undefined).ok).toBe(false);
  });

  it('rejects codenames that are too short or too long', () => {
    expect(checkCodename('K').error).toMatch(/at least/);
    expect(checkCodename('K'.repeat(CODENAME_MAX)).ok).toBe(true);
    expect(checkCodename('K'.repeat(CODENAME_MAX + 1)).error).toMatch(/at most/);
  });

  it('rejects symbols and HTML', () => {
    expect(checkCodename('<script>').ok).toBe(false);
    expect(checkCodename('agent@exun').ok).toBe(false);
    expect(checkCodename('-dash-first').ok).toBe(false);
  });

  it('will not hand out the names of the agents in Transcript A', () => {
    expect(checkCodename('Nano').error).toMatch(/already assigned/);
    expect(checkCodename('MEGA').error).toMatch(/already assigned/);
  });

  it('will not hand out the suspect designation', () => {
    expect(checkCodename('POI-1').error).toMatch(/person of interest/);
    expect(checkCodename('POI1').ok).toBe(false);
    expect(checkCodename('poi 1').ok).toBe(false); // spaces are ignored when comparing
    expect(checkCodename('POI-12').ok).toBe(true); // a different name
  });
});

describe('agent number', () => {
  it('looks like EXN-XXXX-XXXX', () => {
    expect(agentNumber('Kestrel')).toMatch(/^EXN-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('is the same every time for the same codename, whatever the case or spacing', () => {
    expect(agentNumber('Kestrel')).toBe(agentNumber('  KESTREL '));
  });

  it('differs between codenames', () => {
    expect(agentNumber('Kestrel')).not.toBe(agentNumber('Osprey'));
  });
});

describe('story text helpers', () => {
  it('spots TODO-TEAM placeholders', () => {
    expect(isTodo('TODO-TEAM: write the briefing')).toBe(true);
    expect(isTodo('The briefing, written.')).toBe(false);
    expect(isTodo(undefined)).toBe(false);
  });

  it('fills in {names}, and leaves unknown ones alone', () => {
    expect(fillTemplate('Welcome, {codename}.', { codename: 'KESTREL' })).toBe('Welcome, KESTREL.');
    expect(fillTemplate('Hello {nobody}', {})).toBe('Hello {nobody}');
  });

  it('reads nested values by a dotted path', () => {
    const story = { intake: { oath: 'I swear.' } };
    expect(getPath(story, 'intake.oath')).toBe('I swear.');
    expect(getPath(story, 'intake.missing')).toBeUndefined();
    expect(getPath(story, 'nothing.here.at.all')).toBeUndefined();
  });
});
