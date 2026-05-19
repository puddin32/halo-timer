'use strict';

// Unit tests for timer-core.js. Run with `node --test` from the repo root.
// See ADR-0006 for why the runner is Node's built-in one.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CYCLE_MS, itemForCycle, fmtElapsed, deriveCycle, createCueSchedule,
} = require('../timer-core.js');

const CM = CYCLE_MS;            // 60 s, in ms
const T0 = 1_700_000_000_000;   // an arbitrary fixed "started at" timestamp

/* ---------- itemForCycle ---------- */

test('itemForCycle: odd cycles announce power-ups, even cycles rockets', () => {
  assert.equal(itemForCycle(1), 'powerups');
  assert.equal(itemForCycle(2), 'rockets');
  assert.equal(itemForCycle(3), 'powerups');
  assert.equal(itemForCycle(4), 'rockets');
});

test('itemForCycle: alternates without drift over many cycles', () => {
  for (let n = 1; n <= 50; n++) {
    assert.equal(itemForCycle(n), n % 2 === 1 ? 'powerups' : 'rockets');
  }
});

/* ---------- fmtElapsed ---------- */

test('fmtElapsed: formats seconds as zero-padded MM:SS', () => {
  assert.equal(fmtElapsed(0), '00:00');
  assert.equal(fmtElapsed(5), '00:05');
  assert.equal(fmtElapsed(65), '01:05');
  assert.equal(fmtElapsed(600), '10:00');
});

test('fmtElapsed: clamps negative input to zero', () => {
  assert.equal(fmtElapsed(-1), '00:00');
  assert.equal(fmtElapsed(-100), '00:00');
});

test('fmtElapsed: floors fractional seconds', () => {
  assert.equal(fmtElapsed(5.9), '00:05');
  assert.equal(fmtElapsed(59.999), '00:59');
});

test('fmtElapsed: minutes run past 60 with no hours field', () => {
  assert.equal(fmtElapsed(3600), '60:00');
  assert.equal(fmtElapsed(3725), '62:05');
});

/* ---------- deriveCycle ---------- */

test('deriveCycle: just started — no cycles done, full cycle left', () => {
  const c = deriveCycle(T0, T0, CM);
  assert.equal(c.cyclesDone, 0);
  assert.equal(c.cycleEnd, T0 + CM);
  assert.equal(c.remaining, 60);
});

test('deriveCycle: mid first cycle', () => {
  const c = deriveCycle(T0, T0 + 25_000, CM);
  assert.equal(c.cyclesDone, 0);
  assert.equal(c.remaining, 35);
});

test('deriveCycle: an exact cycle boundary counts the cycle as done', () => {
  const c = deriveCycle(T0, T0 + CM, CM);
  assert.equal(c.cyclesDone, 1);
  assert.equal(c.cycleEnd, T0 + 2 * CM);
  assert.equal(c.remaining, 60);
});

test('deriveCycle: catches up past every cycle missed while the tab slept', () => {
  // 5 min 12 s after start: 5 whole cycles done, 12 s into the sixth.
  const c = deriveCycle(T0, T0 + 5 * CM + 12_000, CM);
  assert.equal(c.cyclesDone, 5);
  assert.equal(c.remaining, 48);
});

test('deriveCycle: a forward nudge across a minute boundary advances the cycle', () => {
  const now = T0 + 59_000;                       // 59 s in — 1 s of cycle 1 left
  const before = deriveCycle(T0, now, CM);
  assert.equal(before.cyclesDone, 0);
  assert.equal(itemForCycle(before.cyclesDone + 1), 'powerups');

  // A forward nudge (→) shifts startedAt 1 s earlier; now crosses into cycle 2.
  const after = deriveCycle(T0 - 1_000, now, CM);
  assert.equal(after.cyclesDone, 1);
  assert.equal(itemForCycle(after.cyclesDone + 1), 'rockets');
});

test('deriveCycle: a backward nudge across a minute boundary rewinds the cycle', () => {
  const now = T0 + 60_500;                       // 0.5 s into cycle 2
  const before = deriveCycle(T0, now, CM);
  assert.equal(before.cyclesDone, 1);
  assert.equal(itemForCycle(before.cyclesDone + 1), 'rockets');

  // A backward nudge (←) shifts startedAt 1 s later; now falls back into cycle 1.
  const after = deriveCycle(T0 + 1_000, now, CM);
  assert.equal(after.cyclesDone, 0);
  assert.equal(itemForCycle(after.cyclesDone + 1), 'powerups');
});

test('deriveCycle: never reports negative cycles if now precedes startedAt', () => {
  const c = deriveCycle(T0, T0 - 5_000, CM);
  assert.equal(c.cyclesDone, 0);
  assert.equal(c.remaining, 60);
});

test('deriveCycle: defaults the cycle length to 60 s when omitted', () => {
  const c = deriveCycle(T0, T0 + 30_000);
  assert.equal(c.cyclesDone, 0);
  assert.equal(c.remaining, 30);
});

/* ---------- createCueSchedule ---------- */

const ALL_CUES = { n50: true, n40: true, n30: true, n20: true, final: true };

test('cue schedule: a number cue is due once at its mark, then never again', () => {
  const s = createCueSchedule();
  assert.deepEqual(s.due(50, 0, ALL_CUES), ['n50']);
  assert.deepEqual(s.due(48, 0, ALL_CUES), []);   // same cue, later in its window
  assert.deepEqual(s.due(41, 0, ALL_CUES), []);
});

test('cue schedule: each number cue fires at its own mark', () => {
  const s = createCueSchedule();
  assert.deepEqual(s.due(50, 0, ALL_CUES), ['n50']);
  assert.deepEqual(s.due(40, 0, ALL_CUES), ['n40']);
  assert.deepEqual(s.due(30, 0, ALL_CUES), ['n30']);
  assert.deepEqual(s.due(20, 0, ALL_CUES), ['n20']);
});

test("cue schedule: the final countdown resolves to the cycle's item", () => {
  // cyclesDone 0 -> cycle 1 -> power-ups; cyclesDone 1 -> cycle 2 -> rockets.
  assert.deepEqual(createCueSchedule().due(10, 0, ALL_CUES), ['powerups']);
  assert.deepEqual(createCueSchedule().due(10, 1, ALL_CUES), ['rockets']);
});

test('cue schedule: cues missed while the tab slept are skipped, not dumped', () => {
  const s = createCueSchedule();
  // First tick after a throttled gap lands at 28 s — past the 50 and 40
  // marks. Only the cue whose (at-10, at] window covers 28 is due.
  assert.deepEqual(s.due(28, 0, ALL_CUES), ['n30']);
  assert.deepEqual(s.due(20, 0, ALL_CUES), ['n20']);
});

test('cue schedule: a disabled cue still counts as fired (fire-but-silent)', () => {
  const s = createCueSchedule();
  assert.deepEqual(s.due(50, 0, { ...ALL_CUES, n50: false }), []);
  // n50's mark has passed and it is fired — re-enabling does not replay it.
  assert.deepEqual(s.due(45, 0, ALL_CUES), []);
});

test('cue schedule: reset clears the cycle so cues fire again', () => {
  const s = createCueSchedule();
  assert.deepEqual(s.due(50, 0, ALL_CUES), ['n50']);
  s.reset();
  assert.deepEqual(s.due(50, 0, ALL_CUES), ['n50']);
});

test('cue schedule: syncTo pre-fires every cue already past, so a nudge is silent', () => {
  const s = createCueSchedule();
  s.syncTo(25);                                       // nudged to 25 s remaining
  assert.deepEqual(s.due(25, 0, ALL_CUES), []);       // 50/40/30 already counted fired
  assert.deepEqual(s.due(20, 0, ALL_CUES), ['n20']);  // 20 still ahead — fires normally
  assert.deepEqual(s.due(10, 0, ALL_CUES), ['powerups']);
});

test('cue schedule: syncTo into the final 10 s pre-fires the final countdown', () => {
  const s = createCueSchedule();
  s.syncTo(7);
  assert.deepEqual(s.due(7, 0, ALL_CUES), []);
});

test('cue schedule: the final countdown does not fire at zero seconds', () => {
  assert.deepEqual(createCueSchedule().due(0, 0, ALL_CUES), []);
});
