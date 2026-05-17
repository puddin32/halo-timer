# 1. Static PWA with no build step or framework

Date: 2026-05-17

## Status

Accepted

## Context

The app is a faithful recreation of an Android respawn timer. It is small —
one screen, one options dialog, a few hundred lines of logic. It is hosted
on GitHub Pages and is maintained as a side project by a single developer.

A conventional front-end stack (a framework, a bundler, npm dependencies, a
CI build) would add a toolchain to install, update, and keep working over
the years for an app whose feature surface is essentially fixed.

## Decision

Ship the app as plain static files with **no build step and no framework**:
one `index.html`, one `app.js` (`'use strict'`, module-free globals), one
`styles.css`, plus a service worker and a web manifest. No npm
dependencies, no transpilation, no bundler.

GitHub Pages serves the repo directly; what is committed is what runs.

## Consequences

- The repo is editable and debuggable with nothing installed; `git push`
  deploys. No supply-chain surface, no toolchain rot.
- No JSX/TypeScript/module ergonomics. `app.js` is a single global scope —
  acceptable at this size, but it does not scale to a large app.
- Browser-API compatibility is the developer's responsibility, since there
  is no Babel/polyfill layer. The app targets modern evergreen browsers.
- Any future need for a build (asset hashing, code splitting) would be a
  reversal of this decision and should get its own ADR.
