'use strict';

/*
 * timer-core.js — the pure, DOM-free timer logic.
 *
 * Loaded as a plain <script> before app.js, so in the browser these
 * functions are globals that app.js uses directly. In Node they are
 * reachable via the guarded module.exports at the foot of the file (which
 * the browser never runs), so they can be unit-tested with `node --test`.
 * No build step — see ADR-0006.
 */

const CYCLE_MS = 60 * 1000;                // one cycle, in milliseconds

// Completed cycle N spawns power-ups when N is odd, rockets when N is even.
// The dial calls this as itemForCycle(cyclesDone + 1) to show the next item.
function itemForCycle(n) {
  return n % 2 === 1 ? 'powerups' : 'rockets';
}

// Format a duration in seconds as MM:SS — clamped at zero, floored, and
// with no hours field (the minutes run past 60 over a long match).
function fmtElapsed(sec) {
  sec = Math.max(0, Math.floor(sec));
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' +
         String(sec % 60).padStart(2, '0');
}

// Re-derive cycle state from wall-clock timestamps (see ADR-0002). Given
// when the timer started and the current time, returns how many cycles
// have completed, when the current cycle reaches zero, and the seconds
// left in it. This is the single source of cycle arithmetic — nudge() and
// tick() both call it rather than each reimplementing the maths, so a
// re-synced or tab-slept timer stays consistent across minute boundaries.
function deriveCycle(startedAt, now, cycleMs = CYCLE_MS) {
  const elapsed = Math.max(0, now - startedAt);       // never count negative time
  const cyclesDone = Math.floor(elapsed / cycleMs);
  const cycleEnd = startedAt + (cyclesDone + 1) * cycleMs;
  const intoCycle = elapsed - cyclesDone * cycleMs;   // ms into the current cycle
  const remaining = (cycleMs - intoCycle) / 1000;
  return { cyclesDone, cycleEnd, remaining };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CYCLE_MS, itemForCycle, fmtElapsed, deriveCycle };
}
