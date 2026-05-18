# 6. Tests run on Node's built-in test runner

Date: 2026-05-18

## Status

Accepted

## Context

ADR-0001 ships the app as static files with no build step, no framework
and no npm dependencies. That decision governs the *deployed app* — what
GitHub Pages serves. It says nothing about how the code is verified, and
until now there were no automated tests at all.

The cycle arithmetic (ADR-0002) is the app's most error-prone logic:
`nudge()` re-syncs a running timer across minute boundaries, and `tick()`
catches up past cycles missed while the tab slept. It is pure arithmetic
over timestamps and is worth testing — but it cannot be exercised in a
browser without a running clock and a DOM.

A conventional test stack (Jest, Vitest, a bundler) would reintroduce
exactly the npm-dependency and toolchain surface ADR-0001 exists to avoid.

## Decision

Test with **Node's built-in test runner** — `node:test` and `node:assert`,
both part of the Node runtime (stable since Node 20). Tests live in
`test/` and run with `node --test` from the repo root. There are no npm
dependencies, no `package.json`, and no build step.

To make the logic reachable from Node, the pure timer arithmetic is
extracted into `timer-core.js` — `itemForCycle`, `fmtElapsed` and
`deriveCycle`. That file is a plain `<script>` in the browser, where its
functions are globals that `app.js` uses; in Node it is `require()`-able
via a guarded `module.exports` at the foot of the file that the browser
never executes.

## Consequences

- The deployed app is unchanged: still static files, no build step, no
  dependencies. ADR-0001 holds for what ships.
- Running the tests requires Node installed locally (and in any future
  CI). This is a developer-only tool, not a runtime or deploy dependency.
- Only the DOM-free logic in `timer-core.js` is unit-tested. Code in
  `app.js` that touches the DOM, Web Audio or the wake lock is still
  verified by hand.
- `deriveCycle` is now the single source of cycle arithmetic; `nudge()`
  and `tick()` call it instead of each reimplementing the maths.
