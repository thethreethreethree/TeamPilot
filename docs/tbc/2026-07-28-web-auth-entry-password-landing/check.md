# CHECK — auth-entry audit

Audited the built files: `PasswordInput.tsx`, `landing.ts`, the `/api/me/landing` route,
and the seven edited surfaces.

## Within-module pass (four layers)

- **1 structure:** one reusable `PasswordInput` (spreads props, owns `type`) and one shared
  `landing.ts` (`moduleLanding` map + `resolveUserLanding` + `fetchLanding`). No duplication.
- **2 effectivity:** the eye button flips the input `type` so typed chars render; a care-only
  user signing in resolves to `/dashboard/care`. Both invoked the way a real user invokes them.
- **3 composition:** the reported bug lived HERE — a care user landed on the hub, stalled. Now
  every post-auth entry (login, redeem, recover, invite) lands them in their module, flowing.
  The toggle also lets a user verify a password before submit (fewer failed logins).
- **4 surface:** eye/eye-off (lucide) matches the app; module landings match each module home.

## Cross-module pass (A21)

"Where does auth land the user" existed in multiple surfaces with divergent behaviour — that
divergence WAS the bug. Now login, redeem, recover and invite all route through the SAME
`fetchLanding()` → `/api/me/landing` → `resolveUserLanding` / `moduleLanding`. One behaviour,
one map. `PasswordInput` likewise unifies all six password fields on one component.

## Class sweep (A26)

- **Task 1 class** — a password field with no reveal toggle. sweep: `grep -rn 'type="password"'
  src --include=*.tsx` → **0 remaining** outside `PasswordInput.tsx` itself. Boundary clean.
- **Task 2 class** — a post-auth redirect that hardcodes `/dashboard`, ignoring module. sweep:
  `grep -rnE 'router\.(push|replace)\("/dashboard"\)|redirect\("/dashboard"\)' src/app`. Found
  four: `auth/recover:150` and `invite/[code]:87` were genuine siblings — **both fixed in this
  build**. `sales-coach/layout:58` (an access guard sending non-coach users away) and
  `demo:16` (demo, no module) are correct and intentionally left. Boundary swept.

## Findings

No findings left open — the two siblings the sweep surfaced were fixed here, not deferred.
One config item recorded as residual (email-confirm redirect uses Supabase Site URL).

## Gate-or-promise

The A21 divergence is prevented structurally: all landing decisions flow through one
`moduleLanding` map, so a future surface that wants "land the user" imports it rather than
re-deciding. Not a standing lint gate (that would be noisy); the chokepoint is the gate.

## Inspected / not-inspected

- **Inspected:** the 3 new files; all 7 edited surfaces; both class sweeps run repo-wide.
- **NOT inspected (→ residual):** the actual Supabase Site URL / `emailRedirectTo` config
  (email-confirm link destination) — a deployment-config item, not code.
