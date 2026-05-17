# 2. Wall-clock timestamps drive the timer

Date: 2026-05-17

## Status

Accepted

## Context

The timer must stay accurate over a long match. The obvious implementation
— a counter decremented on every `setInterval` tick — drifts: intervals are
not exact, and browsers throttle or fully pause timers in background tabs.
On a phone with the screen off, a tick-counter timer would fall behind by
however long the tab was suspended, and the spawn callouts would be wrong.

## Decision

Drive the timer from **wall-clock timestamps** (`Date.now()`), not a tick
counter. On START the app records `startedAt` and computes `cycleEnd`. The
`tick()` function runs every 200ms only to *re-derive* state — `remaining`,
`cyclesDone`, the current item — from the current time. When a cycle has
fully elapsed (e.g. after the tab slept), `tick()` advances past every
missed cycle in a loop until `cycleEnd` is back in the future.

A `fired` set tracks which cues have played in the current cycle, and cue
checks use a `(at-10, at]` window so a tab that was throttled does not dump
every missed callout at once on the next tick.

## Consequences

- The displayed time and the spawn schedule stay correct across background
  throttling, tab sleep, and inexact interval timing.
- `nudge()` can re-sync a running timer simply by shifting `startedAt` and
  re-deriving everything else — cycle count, item, colour stay consistent
  even across a minute boundary.
- Cues missed while the tab was asleep are silently skipped rather than
  replayed; this is intentional (a burst of stale callouts would be worse
  than silence).
- The 200ms interval is now just a render cadence, not a source of truth —
  its exact value is not load-bearing.
