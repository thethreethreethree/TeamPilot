# CHECK — Elostate landing rebuild: hero + differentiator (preview route)

## Audit (H1)
- Rendered `/landing-preview` against the live dev server (Next 16 / Turbopack) and screenshotted hero + the
  differentiator: both render on-brand (matte black + signal yellow, Sora, filament-e bulb), the hero is
  vertically centered with the headline breaking correctly, and the differentiator shows the symptom→trace→
  root-cause flow with the lit nodes. Layout confirmed on desktop and a narrow width.
- Robustness verified structurally: the differentiator's content is present in the SSR HTML (curl grep hit
  "The actual problem" / "Decisions are being deferred" / "where Elostate begins"), so a no-JS visitor sees it;
  `Reveal` only *arms* the hidden state client-side, and reduced-motion short-circuits to visible.
- Live `src/app/page.tsx` (elostate.com) is untouched — the rebuild lives only under `/landing-preview`.

## Class sweep (A26)
The motion-invisibility failure mode was swept across the build: every animated surface (hero entry, bulb,
every scroll section via `Reveal`) now defaults to visible and enhances with animation, rather than depending on
JS to become visible. No animated element hides content permanently on JS failure.

## Findings
no findings in this build's own change. Two items surfaced but are NOT defects in this build: (1) 5 pre-existing
high npm-audit vulns (brace-expansion / fast-uri / js-yaml transitive + a Next.js rewrites SSRF) — none from
framer-motion; flagged to the founder, not auto-fixed on live prod (§3.3). (2) the preview route inherits the
app's global chrome (Feedback/chat widgets) — to be suppressed when the real page.tsx adopts the landing.

## Verification (A38)
```
$ npx tsc --noEmit -p tsconfig.json
(no landing errors) tsc_exit=0

$ curl -s -o /dev/null -w '%{http_code}' http://localhost:4321/landing-preview
200

$ curl -s http://localhost:4321/landing-preview | grep -oE "The actual problem|Decisions are being deferred|where Elostate begins"
The actual problem
Decisions are being deferred
where Elostate begins
```
Rendered screenshots (hero desktop/mobile, differentiator) confirmed the layout visually. Full `npm run check`
is the CI gate on push.
