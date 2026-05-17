'use strict';

/*
 * Faithful web recreation of the "Timer for Halo 1" Android app
 * (com.jeffrey.halo1timers), rebuilt from the original APK's assets.
 *
 * Model: a continuous 60-second cycle. Overshield ("power-ups") spawns
 * every 60s; rockets spawn every 120s, so the end-of-cycle callout
 * alternates power-ups, rockets, power-ups... starting with power-ups.
 *
 * Audio: short number clips (~0.9s) call 50/40/30/20. The "rockets" and
 * "power-ups" clips are ~10s recordings of the final countdown + item
 * name, so they start at 10s remaining. Spawn.mp3 is the spawn beep.
 */

const CYCLE = 60;                          // seconds per spawn cycle
const STORE = 'halo1timer.settings.v2';
const APP_VERSION = 'v1.0';
const APP_UPDATED = 'May 17, 2026';        // bump on each released change
const RING_R = 88;
const C = 2 * Math.PI * RING_R;            // ring circumference
const NUMBER_CUES = [50, 40, 30, 20];      // seconds-remaining number callouts
const FINAL_AT = 10;                       // the ~10s countdown clip starts here

// Voice packs (recorded clips lifted from the original APK).
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

const SPAWN_SOUND = 'audio/Spawn.mp3';

const DEFAULTS = {
  voice: 'american_female',
  keepAwake: true,
  nudge: true,
  cues: { n50: true, n40: true, n30: true, n20: true, final: true },
};

let settings = JSON.parse(JSON.stringify(DEFAULTS));
let running = false;
let startedAt = 0;                         // ms timestamp the timer was started
let cycleEnd = 0;                          // ms timestamp the current cycle reaches 0
let cyclesDone = 0;                        // completed cycles
let remaining = CYCLE;                     // seconds left in the current cycle
const fired = new Set();
let wakeLock = null;
let shownItem = null;                      // current item shown on the dial
const audioCache = {};
const primed = new Set();                  // clips already unlocked for playback

const $ = (id) => document.getElementById(id);

// Completed cycle N spawns power-ups when N is odd, rockets when N is even.
const itemForCycle = (n) => (n % 2 === 1 ? 'powerups' : 'rockets');

/* ---------- persistence ---------- */
function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p.voice) settings.voice = p.voice;
    if (typeof p.keepAwake === 'boolean') settings.keepAwake = p.keepAwake;
    if (typeof p.nudge === 'boolean') settings.nudge = p.nudge;
    if (p.cues) settings.cues = { ...settings.cues, ...p.cues };
  } catch (e) { /* ignore */ }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

/* ---------- formatting ---------- */
function fmtElapsed(sec) {
  sec = Math.max(0, Math.floor(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

/* ---------- audio ---------- */
function clipSrcs() {
  const v = VOICES[settings.voice] || VOICES.american_female;
  return [v.n50, v.n40, v.n30, v.n20, v.powerups, v.rockets, SPAWN_SOUND];
}

// Mobile browsers only allow audio after a user gesture. Call this from
// inside a click handler to unlock each clip once: a silent play/pause
// (volume 0) satisfies the gesture requirement without an audible blip.
function primeAudio() {
  clipSrcs().forEach((src) => {
    if (primed.has(src)) return;
    primed.add(src);
    let a = audioCache[src];
    if (!a) { a = audioCache[src] = new Audio(src); a.preload = 'auto'; }
    a.volume = 0;
    a.play()
      .then(() => { a.pause(); a.currentTime = 0; a.volume = 1; })
      .catch(() => { a.volume = 1; });
  });
}

function play(src) {
  if (!src) return;
  let a = audioCache[src];
  if (!a) { a = audioCache[src] = new Audio(src); }
  try { a.currentTime = 0; } catch (e) { /* ignore */ }
  a.play().catch(() => {});
}

function playClip(key) {
  if (key === 'spawn') { play(SPAWN_SOUND); return; }
  const v = VOICES[settings.voice] || VOICES.american_female;
  play(v[key]);
}

/* ---------- wake lock ---------- */
async function acquireWake() {
  if (!settings.keepAwake || wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { wakeLock = null; }
}
async function releaseWake() {
  if (wakeLock) {
    try { await wakeLock.release(); } catch (e) { /* ignore */ }
    wakeLock = null;
  }
}

/* ---------- timer ---------- */
function start() {
  if (running) return;
  primeAudio();
  const now = Date.now();
  startedAt = now;
  cycleEnd = now + CYCLE * 1000;
  cyclesDone = 0;
  remaining = CYCLE;
  fired.clear();
  running = true;
  acquireWake();
  render();
}

function reset() {
  running = false;
  startedAt = 0;
  cycleEnd = 0;
  cyclesDone = 0;
  remaining = CYCLE;
  fired.clear();
  releaseWake();
  render();
}

// Shift the whole cycle to re-sync a timer that was started off-beat.
function nudge(deltaMs) {
  if (!running) return;
  cycleEnd += deltaMs;
  startedAt += deltaMs;
  render();
}

function tick() {
  if (!running) return;
  const now = Date.now();
  remaining = (cycleEnd - now) / 1000;

  if (remaining <= 0) {
    // Advance past every fully-elapsed cycle (e.g. after the tab slept).
    while (cycleEnd <= now) { cyclesDone += 1; cycleEnd += CYCLE * 1000; }
    remaining = (cycleEnd - now) / 1000;
    fired.clear();
    if (settings.cues.final) play(SPAWN_SOUND);   // spawn beep
    render();
    return;
  }

  const secsLeft = Math.ceil(remaining);

  for (const at of NUMBER_CUES) {
    // The window (at-10, at] keeps a single mark from re-firing and avoids
    // dumping every missed cue at once after the tab was throttled.
    if (secsLeft <= at && secsLeft > at - 10 && !fired.has(at)) {
      fired.add(at);
      if (settings.cues['n' + at]) playClip('n' + at);
    }
  }

  if (secsLeft <= FINAL_AT && secsLeft > 0 && !fired.has('final')) {
    fired.add('final');
    if (settings.cues.final) playClip(itemForCycle(cyclesDone + 1));
  }

  render();
}

/* ---------- render ---------- */
function render() {
  const osLeft = Math.max(0, remaining);
  $('time').textContent = Math.min(CYCLE, Math.ceil(osLeft));

  const frac = Math.max(0, Math.min(1, remaining / CYCLE));
  $('ring').style.strokeDashoffset = String(C * (1 - frac));

  const nextItem = itemForCycle(cyclesDone + 1);
  const dial = document.querySelector('.dial');
  if (nextItem !== shownItem) {
    shownItem = nextItem;
    $('dial-icon').src = nextItem === 'rockets' ? 'img/rockets.png' : 'img/powerups.png';
    dial.classList.toggle('cycle-rockets', nextItem === 'rockets');
    dial.classList.toggle('cycle-powerups', nextItem === 'powerups');
  }

  $('phase').textContent = running ? (nextItem === 'rockets' ? 'ROCKETS' : 'POWER-UPS') : 'READY';
  $('elapsed').textContent = fmtElapsed(running ? (Date.now() - startedAt) / 1000 : 0);

  dial.classList.toggle('warning', running && remaining <= FINAL_AT && remaining > 0);

  $('start-btn').textContent = running ? 'RESET' : 'START';
  document.querySelector('.controls').classList.toggle('running', running);
}

/* ---------- init ---------- */
function init() {
  load();

  $('opt-awake').checked = settings.keepAwake;
  $('opt-nudge').checked = settings.nudge;
  $('version-line').textContent = APP_VERSION + ' · updated ' + APP_UPDATED;
  document.querySelector('.controls').classList.toggle('no-nudge', !settings.nudge);
  const voiceRadio = document.querySelector(`input[name="voice"][value="${settings.voice}"]`);
  if (voiceRadio) voiceRadio.checked = true;
  ['n50', 'n40', 'n30', 'n20', 'final'].forEach((k) => {
    const el = $('cue-' + k);
    el.checked = settings.cues[k] !== false;
    el.addEventListener('change', (e) => {
      settings.cues[k] = e.target.checked;
      save();
    });
  });

  $('ring').style.strokeDasharray = String(C);
  render();

  $('start-btn').addEventListener('click', () => { running ? reset() : start(); });
  $('back-btn').addEventListener('click', () => nudge(1000));
  $('fwd-btn').addEventListener('click', () => nudge(-1000));

  $('options-btn').addEventListener('click', () => $('options').showModal());
  $('opt-close').addEventListener('click', () => $('options').close());
  $('opt-test').addEventListener('click', () => { primeAudio(); playClip('n30'); });

  $('opt-awake').addEventListener('change', (e) => {
    settings.keepAwake = e.target.checked;
    save();
    if (running && settings.keepAwake) acquireWake();
    else releaseWake();
  });

  $('opt-nudge').addEventListener('change', (e) => {
    settings.nudge = e.target.checked;
    save();
    document.querySelector('.controls').classList.toggle('no-nudge', !settings.nudge);
  });

  document.querySelectorAll('input[name="voice"]').forEach((r) => {
    r.addEventListener('change', (e) => {
      settings.voice = e.target.value;
      save();
      primeAudio();
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && running) acquireWake();
  });

  setInterval(tick, 200);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

init();
