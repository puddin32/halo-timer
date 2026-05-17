# 3. Web Audio API for cue playback

Date: 2026-05-17

## Status

Accepted

## Context

The app plays spoken countdown cues and a spawn sound. Two recurring
problems with the simple `<audio>`-element approach:

1. **Latency and priming.** The first play of an `<audio>` element is often
   audibly delayed or clipped while the file loads and decodes. A countdown
   callout that arrives late is wrong.
2. **Interruption.** When the user nudges or resets the timer, a
   countdown clip already mid-playback must be cut off — otherwise a stale
   "…three, two, one" keeps talking over the corrected time. Stopping and
   resetting `<audio>` elements reliably is awkward.

Mobile browsers also require audio to be unlocked from a user gesture.

## Decision

Use the **Web Audio API**. On a user gesture (START, voice change, Test
voice) `primeAudio()` resumes the `AudioContext` and decodes every clip of
the active voice pack into an `AudioBuffer` held in memory. Each cue plays
by creating a fresh `AudioBufferSourceNode` from the cached buffer.

The currently-playing node is tracked as `cueNode`; `stopCue()` calls
`.stop()` on it, used by both `nudge()` and `reset()`.

## Consequences

- Cues play instantly with no priming artifact, because the buffer is
  already decoded before it is needed.
- A mid-playback cue can be cut cleanly, so a nudge or reset never leaves a
  stale countdown talking.
- The audio context is unlocked deterministically from a known gesture.
- Cost: clips for the active voice pack are held decoded in memory, and
  switching voice packs re-primes. Acceptable — the clip set is small.
- Buffers are keyed by source URL and shared; `loadingClip` de-dupes
  in-flight loads so a clip is fetched and decoded at most once.
