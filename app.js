'use strict';

/*
 * Faithful web recreation of the "Timer for Halo 1" Android app
 * (com.jeffrey.halo1timers). A single 60-second respawn timer with
 * recorded voice callouts, rebuilt from the original APK's assets.
 */

const DURATION = 60;                       // seconds — the Halo 1 respawn cycle
const STORE = 'halo1timer.settings.v1';
const RING_R = 88;
const C = 2 * Math.PI * RING_R;            // ring circumference

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

// Callout schedule: seconds-remaining -> voice clip key.
const SCHEDULE = [
  { at: 50, clip: 'n50' },
  { at: 40, clip: 'n40' },
  { at: 30, clip: 'n30' },
  { at: 20, clip: 'n20' },
  { at: 10, clip: 'powerups' },
];

let settings = { voice: 'american_female', keepAwake: true };
let remaining = DURATION;                  // seconds left
let running = false;
let endTime = 0;                           // ms timestamp the timer reaches 0
const fired = new Set();
let wakeLock = null;
const audioCache = {};

const $ = (id) => document.getElementById(id);

/* ---------- persistence ---------- */
function load() {
  try {
    const s = localStorage.getItem(STORE);
    if (s) settings = { ...settings, ...JSON.parse(s) };
  } catch (e) { /* ignore */ }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

/* ---------- audio ---------- */
function clipSrcs() {
  const v = VOICES[settings.voice] || VOICES.american_female;
  return [v.n50, v.n40, v.n30, v.n20, v.powerups, v.rockets, SPAWN_SOUND];
}

// Mobile browsers only allow audio after a user gesture. Call this from
// inside a click handler to load and unlock every clip for the active voice.
function primeAudio() {
  clipSrcs().forEach((src) => {
    let a = audioCache[src];
    if (!a) { a = audioCache[src] = new Audio(src); a.preload = 'auto'; }
    a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
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
  if (remaining <= 0) { remaining = DURATION; fired.clear(); }
  endTime = Date.now() + remaining * 1000;
  running = true;
  acquireWake();
  render();
}

function stop() {
  if (!running) return;
  remaining = Math.max(0, (endTime - Date.now()) / 1000);
  running = false;
  releaseWake();
  render();
}

function reset() {
  running = false;
  remaining = DURATION;
  fired.clear();
  releaseWake();
  render();
}

function tick() {
  if (!running) return;
  remaining = (endTime - Date.now()) / 1000;
  const secsLeft = Math.ceil(remaining);

  for (const ev of SCHEDULE) {
    if (remaining > 0 && secsLeft <= ev.at && !fired.has(ev.at)) {
      fired.add(ev.at);
      playClip(ev.clip);
    }
  }

  if (remaining <= 0) {
    remaining = 0;
    running = false;
    if (!fired.has(0)) {
      fired.add(0);
      playClip('rockets');
      playClip('spawn');
    }
    releaseWake();
  }
  render();
}

/* ---------- render ---------- */
function render() {
  $('time').textContent = Math.max(0, Math.ceil(remaining));

  const frac = Math.max(0, Math.min(1, remaining / DURATION));
  $('ring').style.strokeDashoffset = String(C * (1 - frac));

  const dial = document.querySelector('.dial');
  dial.classList.toggle('warning', running && remaining <= 20 && remaining > 0);

  if (remaining <= 0) $('phase').textContent = 'SPAWNED';
  else if (running) $('phase').textContent = 'ROCKETS · POWER-UPS';
  else $('phase').textContent = remaining < DURATION ? 'PAUSED' : 'READY';

  const btn = $('start-btn');
  btn.textContent = running ? 'STOP' : (remaining > 0 && remaining < DURATION ? 'RESUME' : 'START');
  btn.classList.toggle('is-stop', running);
}

/* ---------- init ---------- */
function init() {
  load();

  $('opt-awake').checked = settings.keepAwake;
  const voiceRadio = document.querySelector(`input[name="voice"][value="${settings.voice}"]`);
  if (voiceRadio) voiceRadio.checked = true;

  $('ring').style.strokeDasharray = String(C);
  render();

  $('start-btn').addEventListener('click', () => { running ? stop() : start(); });
  $('reset-btn').addEventListener('click', reset);

  $('options-btn').addEventListener('click', () => $('options').showModal());
  $('opt-close').addEventListener('click', () => $('options').close());
  $('opt-test').addEventListener('click', () => { primeAudio(); playClip('n30'); });

  $('opt-awake').addEventListener('change', (e) => {
    settings.keepAwake = e.target.checked;
    save();
    if (running && settings.keepAwake) acquireWake();
    else releaseWake();
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
