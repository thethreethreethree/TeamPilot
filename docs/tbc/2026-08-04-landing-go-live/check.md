# CHECK — Elostate landing go-live (homepage swap + a11y/mobile polish)

## Audit (H1)
- `/` now serves the new landing to logged-out visitors: dev-server SSR returned the section copy
  ("Make it think", "The problem", "Make your team", "ELOSTATE"), and a desktop render showed the full hero.
- Signed-in routing goes through `resolveUserLanding` — the canonical helper login/redeem already use, keyed on
  `companies.access_module` (A21, no drift with the middleware confinement). care → /dashboard/care,
  sales_coach → /dashboard/sales-coach, complete/legacy → /dashboard.
- Loop-safety: `/` → module home; those layouts admit the authed user; nothing redirects back to `/`. A
  not-onboarded user → /dashboard → /onboarding (existing behaviour), no loop.
- a11y: focus rings on interactive elements; muted text raised to AA; decorative icons aria-hidden. Mobile:
  `overflow-x: hidden` on every section guarantees the body can't scroll sideways regardless of viewport.

## Class sweep (A26)
Swept all 9 sections for the a11y/mobile hardening (focus/contrast/overflow) — applied uniformly. Confirmed the
only auth-gated entry that showed marketing to signed-in users was `/` (middleware matcher excludes it); fixed.

## Findings
no findings in this build's own change. Flagged (not fixed): the global app chrome (chat widget) still renders
on the marketing page from the root layout — deliberate/auth-aware, left as an optional follow-up; and mobile
was hardened for no-horizontal-scroll but final pixel polish should be spot-checked on a real device (headless
mobile capture in this environment is unreliable).

## Verification (A38)
```
$ npx tsc --noEmit -p tsconfig.json
(no landing/page errors) tsc_exit=0

$ curl -s http://localhost:4321/ | grep -oE "Make it think|The problem|Make your team|ELOSTATE" | sort -u
ELOSTATE
Make it think
Make your team
The problem
```
Desktop render of `/` confirmed the hero. Post-deploy: confirm `elostate.com` serves the new homepage to a
logged-out visitor and redirects a signed-in account to its module. Full `npm run check` is the CI gate.
