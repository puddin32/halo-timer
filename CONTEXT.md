# Context

A web recreation of the Android app *Timer for Halo 1* — a talking respawn
timer for *Halo: Combat Evolved*. It is a static, offline-capable PWA: one
HTML page (`index.html`), the timer logic split across `timer-core.js`
(pure cycle arithmetic) and `app.js` (DOM, audio and event wiring), one
stylesheet (`styles.css`), and a service worker (`sw.js`). No build step,
no dependencies, no backend.

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
- **Power-ups** (the overshield) — a pickup that spawns at the end of
  *every* cycle (every 60s). Internally `'powerups'`.
- **Rockets** — a pickup that spawns at the end of every *even-numbered*
  cycle (every 120s), alongside that cycle's power-ups. Internally
  `'rockets'`.
- **Item** — the single pickup a cycle *announces* at its end: **rockets**
  on even cycles, **power-ups** on odd (`itemForCycle`, `shownItem`). Not
  the same as everything a cycle spawns — see **Spawn**. _Avoid_: using
  "item" to mean "all pickups this cycle produces".
- **Spawn** — the moment a cycle reaches zero and its pickups become
  available. Marked by the **spawn sound** (`Spawn.mp3`), a short beep.
  Power-ups spawn at every cycle's spawn; rockets additionally at even
  cycles'.
- **Cue** — an audio callout played during a cycle. Two kinds:
  - **Number cue** — a ~0.9s clip naming the seconds remaining (50, 40, 30,
    20). `NUMBER_CUES` lists the trigger seconds.
  - **Final countdown** — a ~10s clip that counts down the last 10 seconds
    and names the upcoming item. Starts at `FINAL_AT` (10s remaining). The
    "rockets" / "power-ups" voice clips *are* this final-countdown clip.
- **Voice pack** — a named set of recorded cue clips (American / Australian
  / British Female). Lifted from the original APK. Keyed in `VOICES`.
- **Off-beat** — describes a running timer whose metronome has drifted from
  the game's true spawn clock, because the player tapped START slightly
  before or after the real match start. The player detects it by watching
  an in-game spawn — or, on Halo MCC and the NHE modded build, by comparing
  against the on-screen match clock those versions display.
- **Nudge** — a mid-game correction: shifting a running timer one second
  forward or back (the **sync arrows**, ← / →) to pull an **off-beat**
  timer back into sync. Re-derives the whole cycle from the new start time
  so cycle count, item, and colour stay correct across minute boundaries.
- **Prime** — decoding every clip of the active voice pack into memory from
  a user gesture, so later cues play instantly with no audible priming and
  the audio context is unlocked.
- **Dial** — the circular timer face: the progress **ring** fills as the
  cycle elapses, with elapsed time in the centre and the next item's icon
  and colour (red rockets / green power-ups) shown around it.
- **Warning** — the dial state during the final 10 seconds of a cycle.

## Spawn vs. announce

Power-ups spawn at the end of *every* cycle; rockets spawn additionally at
the end of every even cycle. But each cycle announces only **one** pickup —
its **item**. On an even cycle the simultaneous power-ups spawn is
deliberately *not* announced: the player base already knows power-ups spawn
on the even minute, and calling both would clutter the audio. So the
spoken sequence is power-ups, rockets, power-ups… even though power-ups
spawn on every line of it.

## Flagged ambiguities

- "Item" was used both for *what a cycle spawns* and *what it announces* —
  resolved: **Item** is only the announced pickup. Power-ups spawn every
  cycle regardless of which item is announced.

## Conventions

- Plain ES (`'use strict'`), no framework, no transpilation. The app is
  module-free globals: pure cycle arithmetic in `timer-core.js`, DOM and
  audio wiring in `app.js`. `timer-core.js` also has a guarded
  `module.exports` so `node --test` can unit-test it — see ADR-0006.
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
configurable cycle length (Halo: CE's 60s power-ups / 120s rockets spawn
timing is fixed by the game itself), no analytics. This is an unofficial,
non-commercial fan recreation.
