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
  showCredit: true,
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
    if (typeof p.showCredit === 'boolean') settings.showCredit = p.showCredit;
    if (p.cues) settings.cues = { ...settings.cues, ...p.cues };
  } catch (e) { /* ignore */ }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

/* ---------- formatting ---------- */
function fmtElapsed(sec) {
  sec = Math.max(0, Math.floor(sec));
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}

/* ---------- audio (Web Audio API) ---------- */
let audioCtx = null;
let cueNode = null;                        // the cue currently playing, if any
const buffers = {};                        // src -> decoded AudioBuffer
const loadingClip = {};                    // src -> in-flight load Promise

function clipSrcs() {
  const v = VOICES[settings.voice] || VOICES.american_female;
  return [v.n50, v.n40, v.n30, v.n20, v.powerups, v.rockets, SPAWN_SOUND];
}

function ensureAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

function loadClip(src) {
  if (buffers[src]) return Promise.resolve(buffers[src]);
  if (loadingClip[src]) return loadingClip[src];
  const ctx = ensureAudioCtx();
  if (!ctx) return Promise.resolve(null);
  loadingClip[src] = fetch(src)
    .then((r) => r.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .then((buf) => { buffers[src] = buf; delete loadingClip[src]; return buf; })
    .catch(() => { delete loadingClip[src]; return null; });
  return loadingClip[src];
}

// Called from a user gesture (Start tap, voice change, Test voice). Unlocks
// the audio context and decodes every clip for the active voice into memory,
// so callouts later play instantly with no audible priming.
function primeAudio() {
  const ctx = ensureAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  clipSrcs().forEach(loadClip);
}

function startBuffer(buf) {
  const node = audioCtx.createBufferSource();
  node.buffer = buf;
  node.connect(audioCtx.destination);
  node.onended = () => { if (cueNode === node) cueNode = null; };
  node.start();
  cueNode = node;
  return node;
}

// Cut off whatever cue is mid-playback (used when a nudge re-syncs the
// timer, so a stale countdown does not keep talking over the new time).
function stopCue() {
  if (cueNode) {
    try { cueNode.stop(); } catch (e) { /* already ended */ }
    cueNode = null;
  }
}

function play(src) {
  if (!src) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (buffers[src]) { startBuffer(buffers[src]); return; }
  loadClip(src).then((buf) => { if (buf) startBuffer(buf); });
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
  stopCue();                                        // silence any callout still playing
  startedAt = 0;
  cycleEnd = 0;
  cyclesDone = 0;
  remaining = CYCLE;
  fired.clear();
  releaseWake();
  render();
}

// Shift a timer that was started off-beat. Re-derives the cycle from the
// new start time so the cycle count, item and colour stay correct even
// when a nudge crosses a minute boundary.
function nudge(deltaMs) {
  if (!running) return;
  stopCue();                                        // a nudge never leaves a cue talking
  const now = Date.now();
  startedAt = Math.min(now, startedAt + deltaMs);   // never rewind before the start
  cyclesDone = Math.floor((now - startedAt) / (CYCLE * 1000));
  cycleEnd = startedAt + (cyclesDone + 1) * CYCLE * 1000;
  remaining = (cycleEnd - now) / 1000;
  const secsLeft = Math.ceil(remaining);
  fired.clear();
  for (const at of NUMBER_CUES) { if (at > secsLeft) fired.add(at); }
  if (secsLeft <= FINAL_AT) fired.add('final');
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
  $('time').textContent = fmtElapsed(running ? (Date.now() - startedAt) / 1000 : 0);

  // Ring fills as the cycle elapses: empty at cycle start, full at spawn.
  const frac = Math.max(0, Math.min(1, remaining / CYCLE));
  $('ring').style.strokeDashoffset = String(C * frac);

  const nextItem = itemForCycle(cyclesDone + 1);
  const dial = document.querySelector('.dial');
  if (nextItem !== shownItem) {
    shownItem = nextItem;
    $('item-icon').src = nextItem === 'rockets' ? 'img/rockets.png' : 'img/powerups.png';
    dial.classList.toggle('cycle-rockets', nextItem === 'rockets');
    dial.classList.toggle('cycle-powerups', nextItem === 'powerups');
  }

  dial.classList.toggle('warning', running && remaining <= FINAL_AT && remaining > 0);

  $('start-btn').textContent = running ? 'RESET' : 'START';
  document.querySelector('.controls').classList.toggle('running', running);
}

/* ---------- init ---------- */
function init() {
  load();

  $('opt-awake').checked = settings.keepAwake;
  $('opt-nudge').checked = settings.nudge;
  $('opt-credit-toggle').checked = settings.showCredit;
  $('version-line').textContent = APP_VERSION + ' · updated ' + APP_UPDATED;
  document.querySelector('.controls').classList.toggle('no-nudge', !settings.nudge);
  $('app-credit').classList.toggle('hidden', !settings.showCredit);
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

  $('opt-credit-toggle').addEventListener('change', (e) => {
    settings.showCredit = e.target.checked;
    save();
    $('app-credit').classList.toggle('hidden', !settings.showCredit);
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
