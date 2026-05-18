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

/* ---------- cue schedule ---------- */

// The seconds-remaining marks that trigger a number cue, and the point at
// which the final countdown begins — the cue schedule's fixed firing
// rules (see ADR-0002). FINAL_AT is also read by the dial's warning state
// in app.js.
const NUMBER_CUES = [50, 40, 30, 20];
const FINAL_AT = 10;

// A cue schedule tracks which cues have sounded in the current cycle and,
// asked each tick, returns the cues newly due to play. It owns the firing
// rules: the once-only (at-10, at] window for number cues — which also
// skips cues missed while the tab slept (ADR-0002) — the final countdown
// at FINAL_AT, and resolving that countdown to the cycle's item. A cue
// disabled in `cues` still counts as fired (so it cannot re-fire later)
// but is not returned to play.
function createCueSchedule() {
  const fired = new Set();        // cue keys already sounded this cycle

  // Begin a fresh cycle — nothing has fired yet.
  function reset() {
    fired.clear();
  }

  // Re-seed after a nudge: every cue whose moment has already passed by
  // `secsLeft` counts as fired, so the nudge does not replay them.
  function syncTo(secsLeft) {
    fired.clear();
    for (const at of NUMBER_CUES) {
      if (at > secsLeft) fired.add('n' + at);
    }
    if (secsLeft <= FINAL_AT) fired.add('final');
  }

  // The cues newly due at `secsLeft` of the cycle that ends cycle number
  // `cyclesDone + 1`. Returns clip keys ready for playClip(); marks every
  // due cue fired, including ones disabled in `cues` (fire-but-silent).
  function due(secsLeft, cyclesDone, cues) {
    const keys = [];
    for (const at of NUMBER_CUES) {
      const key = 'n' + at;
      if (secsLeft <= at && secsLeft > at - 10 && !fired.has(key)) {
        fired.add(key);
        if (cues[key]) keys.push(key);
      }
    }
    if (secsLeft <= FINAL_AT && secsLeft > 0 && !fired.has('final')) {
      fired.add('final');
      if (cues.final) keys.push(itemForCycle(cyclesDone + 1));
    }
    return keys;
  }

  return { reset, syncTo, due };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CYCLE_MS, NUMBER_CUES, FINAL_AT,
    itemForCycle, fmtElapsed, deriveCycle, createCueSchedule,
  };
}
