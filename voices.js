'use strict';

/*
 * voices.js — the voice-pack manifest: the single source of truth for the
 * recorded cue clips. Loaded three ways from this one file:
 *   - <script> in index.html — app.js reads VOICES for playback
 *   - importScripts() in sw.js — precaches every clip for offline use
 *   - require() in Node — unit-tested via the guarded module.exports
 * Adding a voice pack here updates playback and offline caching together.
 * No build step — see ADR-0006.
 */

const SPAWN_SOUND = 'audio/Spawn.mp3';

// The six clip keys every voice pack provides. clipPaths and allClipPaths
// derive their file lists from this, so sw.js never needs to know the
// internal shape of a pack.
const CLIP_KEYS = ['n50', 'n40', 'n30', 'n20', 'powerups', 'rockets'];

// Voice packs — recorded clips lifted from the original APK. Each pack has
// the six CLIP_KEYS plus a display label.
const VOICES = {
  american_female: {
    label: 'American Female',
    n50: 'audio/american_female/0_american_50.mp3',
    n40: 'audio/american_female/1_american_40.mp3',
    n30: 'audio/american_female/2_american_30.mp3',
    n20: 'audio/american_female/3_american_20.mp3',
    powerups: 'audio/american_female/4_american_powerups.mp3',
    rockets: 'audio/american_female/5_american_rockets.mp3',
  },
  australian_female: {
    label: 'Australian Female',
    n50: 'audio/australian_female/0_au_50.mp3',
    n40: 'audio/australian_female/1_au_40.mp3',
    n30: 'audio/australian_female/2_au_30.mp3',
    n20: 'audio/australian_female/3_au_20.mp3',
    powerups: 'audio/australian_female/4_au_power_ups.mp3',
    rockets: 'audio/australian_female/5_au_rockets.mp3',
  },
  british_female: {
    label: 'British Female',
    n50: 'audio/british_female/0_british_50.mp3',
    n40: 'audio/british_female/1_british_40.mp3',
    n30: 'audio/british_female/2_british_30.mp3',
    n20: 'audio/british_female/3_british_20.mp3',
    powerups: 'audio/british_female/4_british_power_ups.mp3',
    rockets: 'audio/british_female/5_british_rockets.mp3',
  },
};

// Every audio file the given voice pack needs, including the spawn beep.
// An unknown voice key falls back to the American pack.
function clipPaths(voiceKey) {
  const v = VOICES[voiceKey] || VOICES.american_female;
  return [...CLIP_KEYS.map((k) => v[k]), SPAWN_SOUND];
}

// Every audio file across all voice packs, plus the spawn beep — the
// service worker precaches this so any pack is available offline.
function allClipPaths() {
  const paths = [SPAWN_SOUND];
  for (const v of Object.values(VOICES)) {
    for (const k of CLIP_KEYS) paths.push(v[k]);
  }
  return paths;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SPAWN_SOUND, CLIP_KEYS, VOICES, clipPaths, allClipPaths };
}
