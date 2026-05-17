# Context

A web recreation of the Android app *Timer for Halo 1* — a talking respawn
timer for *Halo: Combat Evolved*. It is a static, offline-capable PWA: one
HTML page (`index.html`), one script (`app.js`), one stylesheet
(`styles.css`), and a service worker (`sw.js`). No build step, no
dependencies, no backend.

## What it does

The timer runs a continuous loop. Each loop is a **cycle** lasting 60
seconds. As a cycle counts down it speaks **number cues** (50 / 40 / 30 /
20 seconds remaining) and a **final countdown**, then plays the **spawn
sound** at zero and starts the next cycle. The thing that spawns alternates
each cycle, so the spoken callout alternates with it.

## Glossary

Use these terms exactly. They are the project's domain language — issue
titles, test names, and proposals should reuse them rather than drift to
synonyms.

- **Cycle** — one 60-second countdown. The timer is an unbroken sequence of
  cycles from START until RESET. `CYCLE` is the constant (60s); `cyclesDone`
  counts completed cycles.
- **Item** — what spawns at the end of a cycle: either **power-ups** or
  **rockets**. Internally `'powerups'` / `'rockets'`. *Power-ups* is the
  overshield. Odd completed cycle → power-ups; even → rockets (so the
  sequence is power-ups, rockets, power-ups…). Power-ups thus spawn every
  60s, rockets every 120s.
- **Spawn** — the moment a cycle reaches zero and an item becomes
  available. Marked by the **spawn sound** (`Spawn.mp3`), a short beep.
- **Cue** — an audio callout played during a cycle. Two kinds:
  - **Number cue** — a ~0.9s clip naming the seconds remaining (50, 40, 30,
    20). `NUMBER_CUES` lists the trigger seconds.
  - **Final countdown** — a ~10s clip that counts down the last 10 seconds
    and names the upcoming item. Starts at `FINAL_AT` (10s remaining). The
    "rockets" / "power-ups" voice clips *are* this final-countdown clip.
- **Voice pack** — a named set of recorded cue clips (American / Australian
  / British Female). Lifted from the original APK. Keyed in `VOICES`.
- **Nudge** — shifting a running timer one second forward or back (the
  **sync arrows**, ← / →) to re-sync a timer that was started off-beat.
  Re-derives the whole cycle from the new start time so cycle count, item,
  and colour stay correct across minute boundaries.
- **Prime** — decoding every clip of the active voice pack into memory from
  a user gesture, so later cues play instantly with no audible priming and
  the audio context is unlocked.
- **Dial** — the circular timer face: the progress **ring** fills as the
  cycle elapses, with elapsed time in the centre and the next item's icon
  and colour (red rockets / green power-ups) shown around it.
- **Warning** — the dial state during the final 10 seconds of a cycle.

## Conventions

- Plain ES (`'use strict'`), no framework, no transpilation. The whole app
  is module-free globals in `app.js`.
- The timer is driven by wall-clock timestamps (`Date.now()`), not a tick
  counter — `tick()` runs every 200ms and re-derives state, so a throttled
  or slept tab catches up correctly instead of drifting.
- Settings (voice, cue toggles, keep-awake, sync-arrows, credit) persist to
  `localStorage` under the `STORE` key; bump the key's version suffix on a
  breaking shape change.
- Audio uses the Web Audio API (decoded `AudioBuffer`s), not `<audio>`
  elements, so cues can be cut off mid-playback (`stopCue`) on nudge/reset.
- Released changes bump `APP_VERSION` and `APP_UPDATED` in `app.js`.

## Not in scope

No accounts, no network calls beyond loading static assets, no
configurable cycle length (60s is fixed to match the original game), no
analytics. This is an unofficial, non-commercial fan recreation.
