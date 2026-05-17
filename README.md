# Timer for Halo 1

A web recreation of the **"Timer for Halo 1"** Android app — a talking
respawn timer for *Halo: Combat Evolved*. It runs a continuous 60-second
cycle: the overshield ("power-ups") spawns every 60 seconds and rockets
every 120, so the spoken callouts alternate — power-ups, rockets,
power-ups — as the timer loops.

**Live:** https://puddin32.github.io/halo1-timer/

Open it in a mobile browser and use *Add to Home Screen* to install it as
an offline app.

## Using it

- **START** when the match begins; the timer loops 60-second cycles until
  you press **RESET**.
- Each cycle a voice counts down **50 / 40 / 30 / 20** seconds, then a
  final 10-second countdown, then the spawn callout.
- The dial fills like a clock and shows total elapsed time; the icon and
  colour (red rockets / green power-ups) show what spawns next.
- **← / →** nudge the timer one second back or forward to re-sync a timer
  started off-beat. They show while running and can be hidden in Options.
- The **gear** opens Options: voice pack (American / Australian / British
  Female), which audio cues play, keep-screen-on, and the sync-arrows
  toggle.

Works fully offline once loaded, supports a landscape layout, and saves
its settings on the device.

## What's different from the original

This aims to be a faithful recreation, with three deliberate changes:

- **It's a web app.** The original was an Android-only APK; this runs in
  any modern browser — phone or desktop — and installs as an offline PWA.
- **Per-cue audio toggles.** Options lets you turn each callout (50 / 40 /
  30 / 20 and the final 10-second countdown) on or off individually; the
  original always played them all.
- **Timer sync arrows.** The ← / → controls nudge a running timer one
  second either way to re-sync a start made off-beat — something the
  original had no way to do.

## Credits & attribution

This is an **unofficial fan recreation** of *Timer for Halo 1* (Android
package `com.jeffrey.halo1timers`), created by **Jeff "PacMayne" Powell**.
The recorded voice callouts, the spawn sound, and the rocket / overshield
artwork used here are taken from that original app — full credit to its
creator.

- Original app video by the creator: https://youtu.be/EXKX3KgPdeo

*Halo* and *Halo: Combat Evolved* are trademarks of Microsoft and 343
Industries (originally Bungie). This is a non-commercial fan project, not
affiliated with or endorsed by them.
