'use strict';

// Unit tests for timer-core.js. Run with `node --test` from the repo root.
// See ADR-0006 for why the runner is Node's built-in one.

const test = require('node:test');
const assert = require('node:assert/strict');
const { CYCLE_MS, itemForCycle, fmtElapsed, deriveCycle } = require('../timer-core.js');

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
