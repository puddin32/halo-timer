# 4. Split service-worker caching: cache-first assets, network-first shell

Date: 2026-05-17

## Status

Accepted

## Context

The app must work fully offline once loaded — that is the point of
installing it to the home screen before a match. A service worker that
serves everything cache-first achieves offline use, but then code changes
never reach an installed user without a manual cache bump and reload.

The repo has two kinds of asset with opposite needs:

- **Media** (`.mp3`, `.png`, `.ico`) — large, and effectively immutable;
  the voice clips and artwork never change.
- **App shell** (`index.html`, `styles.css`, `app.js`, the manifest) —
  small, and changes on every release.

## Decision

Use **two fetch strategies in one service worker**, chosen per request by
file extension (`isImmutable`):

- **Immutable media → cache-first.** Serve from cache if present, otherwise
  fetch and populate the cache. Fast, and offline after first load.
- **App shell → network-first.** Fetch from the network and refresh the
  cache; on failure fall back to cache, and finally to `./index.html`.

On `install` the worker pre-caches the full asset list and calls
`skipWaiting()`; on `activate` it deletes caches whose name is not the
current `CACHE` constant and calls `clients.claim()`. Releasing new code
means bumping the `CACHE` version string in `sw.js`.

## Consequences

- Code changes show up on a normal reload when online, while the app still
  works offline by falling back to the cached shell.
- Media is served instantly and never needlessly re-downloaded.
- Voice-pack clips are no longer hand-listed: `sw.js` derives them from
  `allClipPaths()` in `voices.js`, the shared voice-pack manifest, so a
  new pack is precached automatically. The rest of the `ASSETS` list — the
  app shell and images — is still maintained by hand; adding an image
  means adding it there, or it will not be available offline before first
  play.
- The `CACHE` version string must be bumped on release, or `activate` will
  not evict the stale cache.
