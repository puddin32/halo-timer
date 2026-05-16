'use strict';

const STORE_TIMERS = 'halotimer.timers.v1';
const STORE_SETTINGS = 'halotimer.settings.v1';
const DEFAULT_SETTINGS = { voiceEnabled: true, voiceURI: '', volume: 1, rate: 1, keepAwake: true };

let timers = [];
let settings = { ...DEFAULT_SETTINGS };
const runtime = new Map();   // id -> { endTime: number|null, fired: Set<number> }
const cardEls = new Map();   // id -> { root, time, status, repeat }
let voices = [];
let wakeLock = null;
let editingId = null;

const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now() + Math.random().toString(36).slice(2));

/* ---------- persistence ---------- */
function loadTimers() {
  try {
    const raw = localStorage.getItem(STORE_TIMERS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch (e) { /* ignore */ }
  return HALO_CE_PRESETS.map((p) => ({ id: uid(), ...p, thresholds: [...p.thresholds] }));
}

function saveTimers() {
  try { localStorage.setItem(STORE_TIMERS, JSON.stringify(timers)); } catch (e) { /* ignore */ }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORE_SETTINGS);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings() {
  try { localStorage.setItem(STORE_SETTINGS, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

/* ---------- formatting ---------- */
function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return String(sec);
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

/* ---------- speech ---------- */
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices();
  const sel = document.getElementById('s-voice-select');
  sel.innerHTML = '<option value="">Default</option>';
  voices.forEach((v) => {
    const o = document.createElement('option');
    o.value = v.voiceURI;
    o.textContent = `${v.name} (${v.lang})`;
    if (v.voiceURI === settings.voiceURI) o.selected = true;
    sel.appendChild(o);
  });
}

function speak(text) {
  if (!settings.voiceEnabled || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.volume = settings.volume;
    u.rate = settings.rate;
    const v = voices.find((x) => x.voiceURI === settings.voiceURI);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

/* ---------- wake lock ---------- */
async function updateWakeLock(anyRunning) {
  if (!('wakeLock' in navigator)) return;
  if (settings.keepAwake && anyRunning && !wakeLock) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) { wakeLock = null; }
  } else if (wakeLock && (!anyRunning || !settings.keepAwake)) {
    try { await wakeLock.release(); } catch (e) { /* ignore */ }
    wakeLock = null;
  }
}

function anyRunning() {
  return [...runtime.values()].some((r) => r.endTime != null);
}

function evaluateWake() {
  updateWakeLock(anyRunning());
}

/* ---------- timer control ---------- */
function rt(id) {
  if (!runtime.has(id)) runtime.set(id, { endTime: null, fired: new Set() });
  return runtime.get(id);
}

function startTimer(t) {
  const r = rt(t.id);
  r.endTime = Date.now() + t.interval * 1000;
  r.fired = new Set();
  speak(t.name);                 // confirms the tap and unlocks audio on first gesture
  refreshCard(t.id);
  evaluateWake();
}

function stopTimer(id) {
  const r = rt(id);
  r.endTime = null;
  r.fired.clear();
  refreshCard(id);
  evaluateWake();
}

function tick() {
  const now = Date.now();
  for (const t of timers) {
    const r = runtime.get(t.id);
    if (!r || r.endTime == null) continue;

    if (r.endTime - now <= 0) {
      speak(`${t.name} up`);
      if (t.autoRepeat) {
        do { r.endTime += t.interval * 1000; } while (r.endTime <= now);
        r.fired = new Set();
      } else {
        r.endTime = null;
        r.fired.clear();
      }
      refreshCard(t.id);
      continue;
    }

    const secsLeft = Math.ceil((r.endTime - now) / 1000);
    const due = t.thresholds.filter((th) => secsLeft <= th && !r.fired.has(th));
    if (due.length) {
      due.forEach((th) => r.fired.add(th));
      speak(`${t.name} in ${Math.min(...due)}`);
    }
    refreshCard(t.id);
  }
  updateWakeLock(anyRunning());
}

/* ---------- rendering ---------- */
function refreshCard(id) {
  const els = cardEls.get(id);
  if (!els) return;
  const t = timers.find((x) => x.id === id);
  const r = rt(id);
  if (r.endTime == null) {
    els.time.textContent = fmt(t.interval);
    els.status.textContent = 'Tap to start';
    els.root.classList.remove('running', 'warning');
  } else {
    const secsLeft = Math.max(0, Math.ceil((r.endTime - Date.now()) / 1000));
    els.time.textContent = fmt(secsLeft);
    els.status.textContent = 'Tap to restart';
    els.root.classList.add('running');
    els.root.classList.toggle('warning', secsLeft <= 10);
  }
  els.repeat.classList.toggle('on', !!t.autoRepeat);
}

function buildGrid() {
  const grid = document.getElementById('timer-grid');
  grid.innerHTML = '';
  cardEls.clear();

  for (const t of timers) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = t.id;
    card.innerHTML =
      '<div class="card-main" role="button" tabindex="0">' +
        '<div class="card-name"></div>' +
        '<div class="card-time"></div>' +
        '<div class="card-status"></div>' +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="act repeat-toggle" title="Auto-repeat">&#x21bb;</button>' +
        '<button class="act stop-btn" title="Stop">&#x25a0;</button>' +
        '<button class="act edit-btn" title="Edit">&#x270e;</button>' +
      '</div>';

    card.querySelector('.card-name').textContent = t.name;

    const main = card.querySelector('.card-main');
    main.addEventListener('click', () => startTimer(t));
    main.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startTimer(t); }
    });
    card.querySelector('.stop-btn').addEventListener('click', () => stopTimer(t.id));
    card.querySelector('.edit-btn').addEventListener('click', () => openEdit(t.id));
    card.querySelector('.repeat-toggle').addEventListener('click', () => {
      t.autoRepeat = !t.autoRepeat;
      saveTimers();
      refreshCard(t.id);
    });

    grid.appendChild(card);
    cardEls.set(t.id, {
      root: card,
      time: card.querySelector('.card-time'),
      status: card.querySelector('.card-status'),
      repeat: card.querySelector('.repeat-toggle'),
    });
    refreshCard(t.id);
  }
}

/* ---------- add / edit dialog ---------- */
function openEdit(id) {
  editingId = id || null;
  const t = id ? timers.find((x) => x.id === id) : null;
  document.getElementById('edit-title').textContent = t ? 'Edit Timer' : 'Add Timer';
  document.getElementById('f-name').value = t ? t.name : '';
  document.getElementById('f-min').value = t ? Math.floor(t.interval / 60) : 1;
  document.getElementById('f-sec').value = t ? t.interval % 60 : 0;
  document.getElementById('f-thresholds').value = (t ? t.thresholds : [30, 10, 5]).join(', ');
  document.getElementById('f-repeat').checked = t ? !!t.autoRepeat : false;
  document.getElementById('f-delete').style.display = t ? '' : 'none';
  document.getElementById('edit-dialog').showModal();
}

function saveEdit() {
  const name = document.getElementById('f-name').value.trim() || 'Timer';
  const min = parseInt(document.getElementById('f-min').value, 10) || 0;
  const sec = parseInt(document.getElementById('f-sec').value, 10) || 0;
  const interval = Math.max(1, min * 60 + sec);
  const thresholds = document.getElementById('f-thresholds').value
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a);
  const autoRepeat = document.getElementById('f-repeat').checked;

  if (editingId) {
    Object.assign(timers.find((x) => x.id === editingId), { name, interval, thresholds, autoRepeat });
  } else {
    timers.push({ id: uid(), name, interval, thresholds, autoRepeat });
  }
  saveTimers();
  buildGrid();
}

function deleteTimer() {
  if (!editingId) return;
  timers = timers.filter((x) => x.id !== editingId);
  runtime.delete(editingId);
  saveTimers();
  buildGrid();
}

/* ---------- init ---------- */
function init() {
  timers = loadTimers();
  settings = loadSettings();
  buildGrid();

  document.getElementById('s-voice').checked = settings.voiceEnabled;
  document.getElementById('s-volume').value = settings.volume;
  document.getElementById('s-rate').value = settings.rate;
  document.getElementById('s-awake').checked = settings.keepAwake;

  if ('speechSynthesis' in window) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  document.getElementById('settings-btn').onclick =
    () => document.getElementById('settings-dialog').showModal();
  document.getElementById('add-btn').onclick = () => openEdit(null);

  const eDlg = document.getElementById('edit-dialog');
  document.getElementById('edit-form').addEventListener('submit', () => saveEdit());
  document.getElementById('f-cancel').onclick = () => eDlg.close();
  document.getElementById('f-delete').onclick = () => { deleteTimer(); eDlg.close(); };

  const sDlg = document.getElementById('settings-dialog');
  document.getElementById('s-close').onclick = () => sDlg.close();
  document.getElementById('s-voice').onchange =
    (e) => { settings.voiceEnabled = e.target.checked; saveSettings(); };
  document.getElementById('s-voice-select').onchange =
    (e) => { settings.voiceURI = e.target.value; saveSettings(); };
  document.getElementById('s-volume').oninput =
    (e) => { settings.volume = parseFloat(e.target.value); saveSettings(); };
  document.getElementById('s-rate').oninput =
    (e) => { settings.rate = parseFloat(e.target.value); saveSettings(); };
  document.getElementById('s-awake').onchange =
    (e) => { settings.keepAwake = e.target.checked; saveSettings(); evaluateWake(); };
  document.getElementById('s-test').onclick = () => speak('Rockets in 5');
  document.getElementById('s-restore').onclick = () => {
    if (confirm('Replace all timers with the Halo CE defaults?')) {
      timers = HALO_CE_PRESETS.map((p) => ({ id: uid(), ...p, thresholds: [...p.thresholds] }));
      runtime.clear();
      saveTimers();
      buildGrid();
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') evaluateWake();
  });

  setInterval(tick, 250);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

init();
