'use strict';

/*
 * settings.js — the settings contract: the defaults, the versioned
 * localStorage key, and the defensive parse that turns a stored blob back
 * into a valid settings object (ADR-0005). Loaded as a <script> before
 * app.js, and require()-d in tests via the guarded module.exports. No
 * build step — see ADR-0006.
 */

// Bump the version suffix on a breaking change to the settings shape:
// that abandons the old blob and starts fresh from DEFAULTS (ADR-0005).
const STORE = 'halo1timer.settings.v2';

const DEFAULTS = {
  voice: 'american_female',
  keepAwake: true,
  nudge: true,
  showCredit: true,
  holdToReset: true,
  cues: { n50: true, n40: true, n30: true, n20: true, final: true },
};

// Turn a stored blob — the raw localStorage string, or null — back into a
// valid settings object. Every failure mode (absent, corrupt JSON, a
// non-object, an older or partial shape, wrong-typed fields) degrades to
// DEFAULTS rather than propagating (ADR-0005). Returns a fresh object and
// never mutates `defaults`; only whitelisted, correctly-typed fields are
// taken from the blob, and the cues object is narrowed to its known keys.
function parseSettings(raw, defaults) {
  const s = JSON.parse(JSON.stringify(defaults));   // fresh deep copy
  let p;
  try {
    p = JSON.parse(raw);
  } catch (e) {
    return s;                                       // absent or corrupt JSON
  }
  if (!p || typeof p !== 'object') return s;        // null / number / string / etc.

  if (typeof p.voice === 'string') s.voice = p.voice;
  if (typeof p.keepAwake === 'boolean') s.keepAwake = p.keepAwake;
  if (typeof p.nudge === 'boolean') s.nudge = p.nudge;
  if (typeof p.showCredit === 'boolean') s.showCredit = p.showCredit;
  if (typeof p.holdToReset === 'boolean') s.holdToReset = p.holdToReset;
  if (p.cues && typeof p.cues === 'object') {
    for (const k of Object.keys(s.cues)) {
      if (typeof p.cues[k] === 'boolean') s.cues[k] = p.cues[k];
    }
  }
  return s;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STORE, DEFAULTS, parseSettings };
}
