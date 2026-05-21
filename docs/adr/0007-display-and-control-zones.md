# 7. Display and controls are separate zones; the dial confirms, audio drives

Date: 2026-05-20

## Status

Accepted

## Context

The timer is used as a second screen during a competitive *Halo: CE*
session: the phone is propped at arm's length while the player's attention
is on the game. The **audio cues** — the number callouts and the final
countdown — are what actually drive the player's moment-to-moment
decisions. The screen's job is narrower: to *confirm* what the audio
already said, and to let the player glance down to get positioned ahead of
a spawn.

The original layout worked against that. Everything lived inside the dial:
the progress ring, the elapsed time, the START/RESET button and the two
nudge arrows were all stacked within the ring. That overloaded a glance
surface with tap targets. The buttons had to be shrunk to clear the ring,
which made them poor targets for a phone at arm's length, and interactive
controls competing with the display blurred what the dial is *for*.

## Decision

Split the screen into two zones, each with one job:

- **The display** — the dial: progress ring, elapsed time, and the item
  icon. It is an *ambient confirmation* surface: glanceable, never touched.
  It answers "where are we in the cycle, and what's next?"
- **The control zone** — START/RESET and the nudge arrows, in a dedicated
  band below the dial. It answers "what can I do?" with fat tap targets
  sized for a phone at arm's length, no longer squeezed to fit the ring.

The two zones are siblings under `.stage` (`.dial` and `.controls`); the
dial *is* the display zone. The cycle accent colour (cyan / red rockets /
green power-ups) is toggled on `.stage`, their common ancestor, so both
zones theme from one class.

This rests on a principle that should outlast this one change: **audio
drives decisions; the screen confirms.** The player acts on the cues. The
display exists to verify, not to be read continuously. Future visual work
should be judged against that — a change that makes the screen demand
continuous attention is working against the tool.

## Consequences

- The dial is uncluttered and reads at a glance; controls are large and
  hard to miss mid-game.
- A clear rule for future UI work: display elements belong in the dial
  zone, interactive elements in the control zone — do not mix them.
- The split adds vertical height in portrait and becomes a second column
  in landscape. The stylesheet already adapts per orientation, so this is
  a contained change to the existing media query.
- The audio-primary principle is now written down, so later visual
  features (motion, colour, animation) can be checked against it instead
  of each one re-litigating how prominent the screen should be.
