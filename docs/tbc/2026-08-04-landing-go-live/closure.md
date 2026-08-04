# CLOSURE — Elostate landing go-live (homepage swap + a11y/mobile polish)

## What shipped
The new Elostate landing is now the live homepage (`/`). Logged-out visitors see the 9-section marketing arc;
signed-in accounts are redirected to their designated module home (via the canonical `resolveUserLanding`).
Plus the accessibility + mobile hardening pass.

## Un-named reliance (not self-evident)
- **`/` is now a SERVER component that redirects signed-in users.** Do NOT add `"use client"` back — the
  auth-decision must happen server-side (no marketing flash for a signed-in user).
- **Module landing reuses `resolveUserLanding`, not a new copy.** It's keyed on `companies.access_module`, the
  SAME signal the middleware confines on (A21). If you change where a module lands, change it in
  `lib/nav/landing.ts` once — the middleware and this page both follow it.
- **`LandingPage` is the single source** for `/` and `/landing-preview`. Edit sections once.
- **Mobile is hardened for no-horizontal-scroll** (`overflow-x: hidden` per section) but the exact heading
  sizing should be eyeballed on a real phone — the headless mobile capture in this environment misreports the
  viewport width, so it was not a reliable check.
- **The old client marketing homepage is gone from `/`** but preserved in git history.

## Flagged, not fixed (§3.3)
1. Global app chrome (chat widget / feedback) renders on the marketing page from the root layout — auth-aware and
   intentional; suppressing it on the public landing needs a route-group split. Optional follow-up.
2. Proof section testimonials remain labelled placeholders (§3.4) until real pilot quotes exist.
3. Real-device mobile spot-check recommended.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "Headless mobile screenshot could not reliably confirm exact heading sizing.", "why_skipped": "The environment's headless viewport/dsf mapping misreports width; mitigated by overflow-x:hidden per section (no sideways scroll guaranteed) + mobile clamps. A real-device check is the reliable confirmation.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-04T00:39:30Z", "outcome": "OPENED — no-scroll guaranteed by construction; pixel polish pending a device check." },
  { "id": "RES-02", "item": "Global app chrome shows on the public landing.", "why_skipped": "Auth-aware/intentional; route-group split is a larger change, deferred as optional.", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": null }
]
```
