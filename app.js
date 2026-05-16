'use strict';

/*
 * Faithful web recreation of the "Timer for Halo 1" Android app
 * (com.jeffrey.halo1timers), rebuilt from the original APK's assets.
 *
 * Model: a continuous 60-second cycle. Overshield ("power-ups") spawns
 * every 60s; rockets spawn every 120s. The end-of-cycle callout therefore
 * alternates power-ups, rockets, power-ups, rockets... starting with
 * power-ups on the first cycle.
 */

const CYCLE = 60;                          // seconds per spawn cycle
const STORE = 'halo1timer.settings.v1';
const RING_R = 88;
const C = 2 * Math.PI * RING_R;            // ring circumference
const SCHEDULE = [50, 40, 30, 20];         // seconds-remaining number callouts

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

let settings = { voice: 'american_female', keepAwake: true };
let running = false;
let cycleEnd = 0;                          // ms timestamp the current cycle reaches 0
let cyclesDone = 0;                        // completed cycles
let remaining = CYCLE;                     // seconds left in the current cycle
const fired = new Set();
let wakeLock = null;
const audioCache = {};

const $ = (id) => document.getElementById(id);

// Completed cycle N spawns power-ups when N is odd, rockets when N is even.
const itemForCycle = (n) => (n % 2 === 1 ? 'powerups' : 'rockets');

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

/* ---------- formatting ---------- */
function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
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
  cycleEnd = Date.now() + remaining * 1000;
  running = true;
  acquireWake();
  render();
}

function stop() {
  if (!running) return;
  remaining = Math.max(0, (cycleEnd - Date.now()) / 1000);
  running = false;
  releaseWake();
  render();
}

function reset() {
  running = false;
  remaining = CYCLE;
  cyclesDone = 0;
  fired.clear();
  releaseWake();
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
    playClip(itemForCycle(cyclesDone));
    playClip('spawn');
    render();
    return;
  }

  const secsLeft = Math.ceil(remaining);
  for (const at of SCHEDULE) {
    if (secsLeft <= at && !fired.has(at)) {
      fired.add(at);
      playClip('n' + at);
    }
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
  const rocketsLeft = (nextItem === 'rockets') ? osLeft : osLeft + CYCLE;
  $('rockets-time').textContent = fmtClock(rocketsLeft);
  $('powerups-time').textContent = fmtClock(osLeft);

  $('item-rockets').classList.toggle('next', running && nextItem === 'rockets');
  $('item-powerups').classList.toggle('next', running && nextItem === 'powerups');

  const idle = !running && cyclesDone === 0 && remaining >= CYCLE;
  if (running) $('phase').textContent = 'NEXT: ' + (nextItem === 'rockets' ? 'ROCKETS' : 'POWER-UPS');
  else $('phase').textContent = idle ? 'READY' : 'PAUSED';

  document.querySelector('.dial').classList.toggle('warning', running && remaining <= 10 && remaining > 0);

  const btn = $('start-btn');
  btn.textContent = running ? 'STOP' : (idle ? 'START' : 'RESUME');
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
