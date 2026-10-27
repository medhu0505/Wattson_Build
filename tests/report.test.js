// Tests for the case report: it must reflect what the agent actually did.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildReport, reportToText, formatDuration, formatDateTime, reportFileName, suspensionLine } from '../src/lib/report.js';
import { acknowledgeNotice, chooseNext } from '../src/lib/epilogue.js';
import { agentNumber } from '../src/lib/codename.js';
import { createProgress, completeStage } from '../src/state/progress.js';
import canon from '../content/canon.json';
import energy from '../data/energy.json';
import team from '../content/team.json';

const sources = {
  canon,
  energy,
  originalCode: readFileSync(new URL('../OriginalCode.txt', import.meta.url), 'utf8'),
  alteredCode: readFileSync(new URL('../AlteredCode.txt', import.meta.url), 'utf8'),
};

const KEY_PINS = ['location', 'power-draw', 'machine-name', 'machine-id', 'encounter-time', 'poi-description', 'warbling'];

// An agent who has closed the case.
function finishedAgent() {
  return {
    ...createProgress(),
    codename: 'Kestrel',
    startedAt: '2026-10-25T10:00:00.000Z',
    completed: {
      intake: '2026-10-25T10:05:00.000Z',
      files: '2026-10-25T10:20:00.000Z',
      forensics: '2026-10-25T10:40:00.000Z',
      signal: '2026-10-25T10:50:00.000Z',
      machine: '2026-10-25T11:05:00.000Z',
    },
    pins: [...KEY_PINS, 'sender'].map((id, i) => ({ id, x: i / 10, y: 0.5 })),
    answers: {
      forensics: {
        analysed: true,
        referral: {
          surgeDate: '2026-10-23', surgeKwh: '2,684',
          mismatchDate: '2026-10-24', mismatchReported: '503.2', mismatchMetered: '30.7',
        },
      },
      signal: { key: 'blueshirt' },
      machine: { ran: { logs: true, diff: true, render: true }, revealed: true },
    },
    hintsUsed: { forensics: 2 },
  };
}

// An agent who has only finished intake.
function newAgent() {
  return {
    ...createProgress(),
    codename: 'Osprey',
    startedAt: '2026-10-25T10:00:00.000Z',
    completed: { intake: '2026-10-25T10:03:00.000Z' },
  };
}

describe('report from a finished case', () => {
  const report = buildReport(finishedAgent(), sources, new Date('2026-10-25T11:10:00.000Z'));

  it('names the agent and their agent number', () => {
    expect(report.agent).toEqual({ codename: 'Kestrel', number: agentNumber('Kestrel') });
  });

  it('records when each stage was cleared, and how long the case took', () => {
    expect(report.timeline.find((s) => s.title === 'Case Files').afterStart).toBe('20 min');
    expect(report.timeline.find((s) => s.title === 'Case Report').clearedAt).toBeNull();
    expect(report.totalTime).toBe('1 h 05 min');
    expect(report.closed).toBe(true);
  });

  it('lists the pinned evidence in order, marking key details', () => {
    expect(report.evidence).toMatchObject({ found: 7, total: 7, complete: true });
    expect(report.evidence.pins).toHaveLength(8);
    expect(report.evidence.pins[0]).toEqual({ label: canon.pins.location.label, source: 'Case Debrief', key: true });
    expect(report.evidence.pins.at(-1).key).toBe(false);
  });

  it('includes the detector findings and the referral exactly as filed', () => {
    expect(report.forensics.surges).toEqual([{ label: 'Oct 23', metered: 2684 }]);
    expect(report.forensics.mismatches[0]).toMatchObject({ label: 'Oct 24', reported: 503.2, metered: 30.7 });
    expect(report.forensics.referral.surgeKwh).toBe('2,684');
  });

  it('includes the decoded key and the machine findings', () => {
    expect(report.signal).toMatchObject({ decodesTo: 'blueshirt', keyEntered: 'blueshirt' });
    expect(report.machine).toMatchObject({ removed: 17, added: 0, removedFrom: 4, removedTo: 20 });
    expect(report.machine.missing[0].name).toBe('Character');
    expect(report.machine.checksRun).toEqual(['logs', 'diff', 'render']);
  });

  it('counts the hints used', () => {
    expect(report.hints.find((s) => s.title === 'Energy Forensics').used).toBe(2);
  });

  describe('as text', () => {
    const text = reportToText(report, { energy, closing: 'The case is closed.' });

    it('contains every section', () => {
      for (const heading of ['1. TIMELINE', '2. EVIDENCE FILED', '3. ENERGY FORENSICS', '4. SIGNAL ANALYSIS',
        '5. MACHINE EXAMINATION', '6. CASE TIMELINE', '7. CONCLUSION', '8. ASSISTANCE']) {
        expect(text).toContain(heading);
      }
    });

    it('contains the agent, the findings and the closing statement', () => {
      expect(text).toContain('From:    Agent Kestrel');
      expect(text).toContain('Re:      Case #1, Wenoti Arcade, 92nd Avenue, nuxEland');
      expect(text).toContain('STATUS: CASE #1 CLOSED; CASE #2 PENDING');
      expect(text).toContain('Surge: Oct 23, 2,684.0 kWh metered.');
      expect(text).toContain('Surge: Oct 23, 2,684 kWh'); // the referral as typed
      expect(text).toContain('decodes (Base32) to: blueshirt');
      expect(text).toContain('Class Character (original line 4) is gone');
      expect(text).toContain('The case is closed.');
      expect(text).toContain('Hints used: 2');
    });

    it('includes the canon timeline and Agent Nano’s matching finding', () => {
      expect(text).toContain('24 October');
      expect(text).toContain('The game source code is obtained: one character class is missing [Progress Assesment Log]');
      expect(text).toContain('reaches the same finding: "A VIDEO GAME CHARACTER HAS ESCAPED INTO THE REAL WORLD"');
      expect(text).toContain('Open question from Agent Nano: WHY?');
    });

    it('never prints "undefined", "null" or "NaN"', () => {
      expect(text).not.toMatch(/undefined|null|NaN/);
    });

    it('ends with who made the case terminal', () => {
      const credited = reportToText(report, { energy, closing: '', team });
      expect(credited.trim().split('\n').at(-1))
        .toBe('EXUN Case Terminal, made by Team AFBBS: Medhansh Sharma, Aryaveer Dalal and Mudit Shakya.');
    });
  });
});

describe('report once EXUN is suspended', () => {
  const filed = completeStage(finishedAgent(), 'report', new Date('2026-10-27T08:00:00.000Z'));
  const NOW = new Date('2026-10-27T09:00:00.000Z');

  it('leaves the suspension off the case timeline until the report is filed', () => {
    const before = buildReport(finishedAgent(), sources);
    expect(before.caseTimeline.some((event) => event.when === '27 October')).toBe(false);
    expect(buildReport(filed, sources).caseTimeline.at(-1))
      .toEqual({ when: '27 October', what: 'EXUN is suspended by order of the Government of Nuxeland', source: 'Suspension Notice' });
  });

  it('keeps the status as Case #2 pending until the notice is acknowledged', () => {
    expect(buildReport(filed, sources).status).toBe('CASE #1 CLOSED; CASE #2 PENDING');
    expect(buildReport(filed, sources).suspension).toBeNull();
  });

  it('says EXUN is suspended, and what the agent chose, once acknowledged', () => {
    const acknowledged = acknowledgeNotice(filed, NOW);
    const report = buildReport(chooseNext(acknowledged, 'continue'), sources);
    const text = reportToText(report, { energy, closing: 'Closed.' });
    expect(report.status).toBe('CASE #1 CLOSED; EXUN SUSPENDED');
    expect(text).toContain('STATUS: CASE #1 CLOSED; EXUN SUSPENDED');
    expect(text).toContain('EXUN suspended by notice EIA/EXUN/SUS-01, effective 27 October 2026. The agent has not stood down.');
    expect(text).not.toMatch(/undefined|null|NaN/);
    expect(buildReport(acknowledged, sources).suspension.choice).toBeNull();
  });

  it('words each choice', () => {
    const base = { reference: 'EIA/EXUN/SUS-01', effective: '27 October 2026' };
    expect(suspensionLine({ ...base, choice: null })).toBe('EXUN suspended by notice EIA/EXUN/SUS-01, effective 27 October 2026.');
    expect(suspensionLine({ ...base, choice: 'comply' })).toContain('The agent has complied.');
  });
});

describe('report from a case still in progress', () => {
  const report = buildReport(newAgent(), sources);
  const text = reportToText(report, { energy, closing: 'should not appear' });

  it('says the investigation is in progress', () => {
    expect(report.closed).toBe(false);
    expect(text).toContain('STATUS: INVESTIGATION IN PROGRESS');
    expect(report.totalTime).toBeNull();
  });

  it('marks unfinished sections as not completed and leaves out the conclusion', () => {
    expect(text.match(/Not completed\./g).length).toBeGreaterThanOrEqual(5);
    expect(text).not.toContain('should not appear');
    expect(text).toContain('Nothing pinned.');
  });

  it('keeps Agent Nano’s log out of the report until the case is closed', () => {
    expect(text).not.toContain('VIDEO GAME CHARACTER');
    expect(text).not.toContain('source code is obtained');
  });

  it('never prints "undefined", "null" or "NaN"', () => {
    expect(text).not.toMatch(/undefined|null|NaN/);
  });

  it('copes with an agent with no codename or start time', () => {
    const blank = reportToText(buildReport(createProgress(), sources), { energy });
    expect(blank).toContain('Agent Unassigned');
    expect(blank).not.toMatch(/undefined|null|NaN/);
  });

  it('marks a supervisor report, and copes with folders cleared without answers', () => {
    // What "Mark every folder cleared" in supervisor mode produces.
    const progress = {
      ...createProgress(),
      supervisor: true,
      codename: 'Supervisor',
      startedAt: '2026-10-25T10:00:00.000Z',
      completed: Object.fromEntries(['intake', 'files', 'forensics', 'signal', 'machine', 'report']
        .map((id) => [id, '2026-10-25T10:01:00.000Z'])),
    };
    const report = buildReport(progress, sources);
    const supervisorText = reportToText(report, { energy, closing: 'Closed.' });
    expect(report.supervisor).toBe(true);
    expect(supervisorText).toContain('MODE:   SUPERVISOR OVERRIDE');
    expect(supervisorText).toContain('Access key entered: not recorded.');
    expect(supervisorText).toContain('Checks run: none recorded');
    expect(supervisorText).not.toMatch(/undefined|null|NaN/);
  });

  it('does not mark an agent’s own report as supervisor', () => {
    expect(text).not.toContain('SUPERVISOR');
  });

  it('ignores pins that are not in the case files', () => {
    const progress = { ...newAgent(), pins: [{ id: 'made-up', x: 0, y: 0 }] };
    expect(buildReport(progress, sources).evidence.pins).toEqual([]);
  });
});

describe('formatting helpers', () => {
  it('formats durations', () => {
    expect(formatDuration(20 * 1000)).toBe('under a minute');
    expect(formatDuration(20 * 60000)).toBe('20 min');
    expect(formatDuration(65 * 60000)).toBe('1 h 05 min');
    expect(formatDuration(-5)).toBe('unknown');
    expect(formatDuration(NaN)).toBe('unknown');
  });

  it('formats dates, and shows a dash for missing ones', () => {
    expect(formatDateTime('2026-10-25T10:05:00.000Z')).toMatch(/25 Oct 2026/);
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('not a date')).toBe('—');
  });

  it('makes a safe file name from the codename', () => {
    expect(reportFileName('Night Owl')).toBe('exun-case-1-report-night-owl.txt');
    expect(reportFileName("O'Hara")).toBe('exun-case-1-report-o-hara.txt');
    expect(reportFileName('')).toBe('exun-case-1-report-agent.txt');
  });
});
