# 5. Settings persisted to localStorage under a versioned key

Date: 2026-05-17

## Status

Accepted

## Context

User settings — voice pack, per-cue toggles, keep-screen-on, sync-arrows,
credit visibility — must survive a page reload and app restart. The app has
no backend and no accounts, so persistence is necessarily client-side and
per-device. The settings object is a small, flat blob read once at startup
and written on each change.

The shape of that blob will change as features are added or removed, and
old data from a previous shape can be present on a returning user's device.

## Decision

Persist settings to **`localStorage`** as a single JSON blob under a
**versioned key** (`halo1timer.settings.v2`).

`load()` reads the blob defensively: it starts from a deep copy of
`DEFAULTS` and copies in only recognised, correctly-typed fields from
storage, so a partial, corrupt, or older blob degrades to defaults rather
than breaking the app. `save()` writes the whole object. Both wrap their
storage calls in `try/catch` so private-mode or disabled storage is a
no-op, not a crash.

A breaking change to the settings shape is handled by **bumping the version
suffix** in the key, which abandons the old blob and starts fresh from
defaults.

## Consequences

- Settings persist per device with no infrastructure.
- A malformed or out-of-date blob can never crash startup; unknown fields
  are ignored and missing ones fall back to defaults.
- Settings do not roam between devices or browsers — acceptable for this
  app, and the only option without a backend.
- The version suffix is a blunt migration tool: bumping it discards all
  prior settings rather than transforming them. Fine for an app with a
  handful of preferences; a real migration step would need its own ADR.
