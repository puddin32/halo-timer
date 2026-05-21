# 8. RESET takes a hold by default

Date: 2026-05-20

## Status

Accepted

## Context

A timer is reset between matches, but the RESET control lives on the main
screen and is right next to the nudge arrows that a player taps *during*
play. When a single tap resets, a mis-aimed thumb mid-match silently wipes
a running timer: the cycle count, the current item, and — most costly —
the player's hard-won sync with the game's real spawn clock are all gone.
The only recovery is to re-sync against the next observed spawn. In a
competitive session that is a real loss paid at the worst possible moment.

START does not have this problem. Starting a stopped timer is harmless and
wants to be instant.

## Decision

RESET requires a deliberate **~1 second hold** by default. The button
labels itself for the gesture — it reads `HOLD TO RESET` while running —
and a fill sweeps across it during the press. Releasing before the fill
completes does nothing. START stays a single tap.

A **`holdToReset` setting (default on)** lets a player opt back into
one-tap reset. With it off, the button reads `RESET` and a tap resets
immediately. The setting persists like every other preference (ADR-0005).

The hold length lives in one place — the CSS fill animation — and that
animation's `animationend` event is what fires the reset, so the visual
and the trigger cannot drift apart.

## Consequences

- A running timer is no longer one stray tap away from being wiped.
- Every reset now costs the player ~1s and a deliberate press. That
  friction is the point, but it is a real tax on the player who never
  fat-fingers; the `holdToReset` setting is the release valve for them.
- The button has three states (`START` / `HOLD TO RESET` / `RESET`)
  instead of two, and a press gesture distinct from a click. That is more
  interaction surface than a plain button, kept contained to `#start-btn`.
- Hold-to-reset is a pointer gesture; a keyboard-only user cannot perform
  it and a keyboard tap on a running timer does nothing. Acceptable for a
  phone-first app, and noted here for a later accessibility pass.
