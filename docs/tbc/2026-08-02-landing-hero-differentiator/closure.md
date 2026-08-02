# CLOSURE — Elostate landing rebuild: hero + differentiator (preview route)

## What shipped
The first two (founder-priority) sections of the rebuilt Elostate landing — a premium matte-black/signal-yellow
hero with the filament-e bulb mark and the "Make it think" thesis, and the differentiator that *shows* the
diagnostic engine tracing a symptom to its root cause. Assembled at `/landing-preview` (noindex); live
elostate.com is untouched. Plus the reusable infrastructure (tokens, self-hosted Sora, robust `Reveal`).

## Un-named reliance (not self-evident)
- **Nothing is live.** This is a preview route. `src/app/page.tsx` still serves the current landing until the
  founder approves the swap.
- **Robustness by construction.** Hero entry + every scroll reveal ship content VISIBLE and only *arm* the
  hidden-then-reveal when JS is present. Do NOT "optimize" this into `initial:hidden` — that reintroduces the
  blank-hero failure mode the render check caught.
- **Framer Motion is installed but the hero/reveals use CSS + IntersectionObserver.** The dependency is kept for
  a future richer interaction (e.g., module-grid hover previews); it is not on the hero's critical path.
- **Landing palette is deliberately separate** from the app's ember/ink theme (`brand.ts`) — do not wire the
  landing to the global theme tokens; it commits to a single premium dark identity by design.
- **Screenshot verification is unreliable here** (Framer Motion clock vs virtual-time, `svh`, smooth-scroll,
  IntersectionObserver) — the authoritative review is the live dev server at `/landing-preview`.

## Flagged, not fixed (§3.3)
1. **5 pre-existing high npm-audit vulns** (brace-expansion, fast-uri, js-yaml transitive; Next.js rewrites
   SSRF) — none introduced by this build. `npm audit fix` is available but must not run unreviewed on live prod.
   → founder decision.
2. **Global app chrome** (Feedback button / chat widget) bleeds into the preview route from the root layout;
   suppress it for the public marketing page when `page.tsx` adopts the landing.
3. Remaining sections (Problem, Turn, How-it-works, Modules, Proof, Close, Footer) still to build.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No automated test of the landing components (visual/marketing surface).", "why_skipped": "It's a static marketing page verified by render; unit-testing presentational CSS/markup has low value vs the live review. TBC + typecheck + dev-server render cover it.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-02T22:41:37Z", "outcome": "OPENED — verified via typecheck + dev-server render (check.md)." },
  { "id": "RES-02", "item": "The landing is not yet swapped into the live route; page.tsx still serves the old landing.", "why_skipped": "Deliberate — founder reviews the preview before the live swap (§3.3).", "confidence_it_does_not_matter": "high", "opened_at": null, "outcome": null }
]
```
