# 9. Glance state must survive greyscale

Date: 2026-05-20

## Status

Accepted

## Context

The timer leans on colour: a cyan idle state, red for a rockets cycle,
green for a power-ups cycle. The ring, the elapsed time, and the
START/RESET button all take the cycle's accent. Colour is doing real
signalling work.

But the timer is *glanced* at — a phone propped at arm's length, in
whatever lighting the room has, by whoever is playing. Some of those
players are colourblind; red/green is the most common confusion pair, and
this app puts meaning on exactly red versus green. If colour is the *only*
thing separating "rockets next" from "power-ups next", those players
cannot read the dial at all — and everyone reads it worse in glare or at
a glance.

## Decision

Every state a player needs to read at a glance must be distinguishable
**without colour** — through shape, position, size, or icon. Colour is
confirmation and affect; it is never the sole carrier of information.

As the dial stands today:

- **What spawns next** is carried by the **item icon** — the rockets and
  power-ups silhouettes are different shapes — in a fixed slot inside the
  dial. The red/green accent reinforces it; it does not define it.
- **Where the cycle is** is carried by the **ring's fill** — an extent
  and a position — and by the elapsed time. The accent colour reinforces
  it.

The check for any visual change: screenshot it, desaturate it, and confirm
every glanceable state is still readable.

## Consequences

- The item icon is load-bearing, not decoration: it must stay legible as a
  silhouette, and a future item would need a distinct *shape*, not just a
  new colour.
- Any future state — a new cycle type, an alert, a mode — needs a
  non-colour channel before it can ship.
- The greyscale screenshot test is a cheap, repeatable gate for UI work.
- This constrains visual design slightly: it rules out colour-only
  distinctions, which are often the easiest to reach for. That is the
  intended cost.
