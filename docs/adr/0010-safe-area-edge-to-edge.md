# 10. Go edge-to-edge, then inset content with the safe-area insets

Date: 2026-06-28

## Status

Accepted

## Context

Installed to the home screen on a notched iPhone (e.g. iPhone 16 Pro Max),
the app rendered into the hardware cutout regions. `index.html` already
opts the page into the full screen — `viewport-fit=cover` on the viewport
meta and `apple-mobile-web-app-status-bar-style=black-translucent` — so the
page extends behind the Dynamic Island, the rounded corners, and the home
indicator. Nothing compensated for that, so in standalone mode the app bar
(title + gear) sat under the Dynamic Island and the bottom control band
under the home indicator.

We want the dark background to keep bleeding edge-to-edge — a panel of grey
behind the status bar looks broken on a modern phone — while the things a
player actually touches and reads stay inside the safe area, in portrait
*and* landscape (where the notch moves to a side edge).

## Decision

Stay edge-to-edge, and inset the **content** using the CSS environment
variables `env(safe-area-inset-top/right/bottom/left)`.

The insets are applied as `padding` on `body`:

- The background gradient is painted on `body`, and padding is inside the
  border-box, so the gradient still fills the entire screen — including
  behind the cutouts — while the padding is what holds the content clear.
- Putting the four insets in one place makes `body` the single source of
  truth. Inner elements (`.app-bar`, `.stage`, the landscape media queries)
  keep their own fixed padding and need no per-cutout knowledge; the body
  inset stacks underneath them.
- Because all four edges are covered, rotating the phone — which moves the
  notch from the top to a side — is handled by the same rule with no
  orientation-specific code.

On a device with no cutouts the `env()` values resolve to `0`, so this is
inert everywhere except where it is needed.

One wrinkle: the backdrop is a radial-gradient — a background *image* — and
iOS fills the home-indicator safe-area band (and overscroll) with the
background *color*, not the image, which defaults to white. So `html` is
painted a solid `var(--bg-2)` (the gradient's bottom stop) as a base layer
behind everything, keeping that band dark and seamless with the gradient.

## Consequences

- The app is usable installed on notched iPhones; the chrome no longer
  hides under the Dynamic Island or the home indicator.
- New top-level layout must trust the `body` inset rather than re-deriving
  safe-area padding itself — adding insets again on an inner element would
  double the gap.
- This depends on the `viewport-fit=cover` opt-in in `index.html`; without
  it the `env()` insets report `0` and the page would letterbox instead.
  The two settings are a pair.
- The centered grid app bar and the flow layout already keep the content
  off the screen edges, so no element needed re-centering — the cutout
  safety is entirely the inset padding.
