# CHECK — module-lock × member-gate redirect loop

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — a module-LOCKED non-member has no fixed point → infinite redirect (ERR_TOO_MANY_REDIRECTS)
file+line: `src/app/dashboard/sales-coach/layout.tsx` (redirected non-member → `/dashboard`) × `src/middleware.ts:79-95`
(locks `/dashboard` → `/dashboard/sales-coach`). The predicate `isSalesCoachMember({role:'Member',
sales_coach_role:null})` (`src/lib/coach/v5/skillAccess.ts:38-42`) returns false for a freshly-invited rep.
class: workflow-continuity / auth-gate (two guards each correct in isolation redirect into each other's forbidden
path — no fixed point). A CLASS across module layouts (care sibling identical).
severity: critical (a freshly-invited rep — the product's target user — is bricked with a browser error during the
normal invite→assign window; cannot reach any page).
sweep-command: `grep -rn "redirect(\"/dashboard\")" src/app/dashboard/*/layout.tsx` — the module layouts that
redirect a non-member to the hub while the account may be module-locked (was: sales-coach + care; now both route
through `moduleGateDecision` and hold instead).
read-path: fixed — a locked non-member now holds on `ModuleNoAccess` inside the module; only the non-locked
non-member redirects to the hub.

## Class sweep (A26)
Swept both module layouts. `src/app/dashboard/sales-coach/layout.tsx` AND `src/app/dashboard/care/layout.tsx`
had the identical `redirect('/dashboard')`-while-lockable shape; both now route through the shared pure
`moduleGateDecision`, so a future third module can't re-introduce the loop by copy-paste.

## Tests
```
$ npx vitest run moduleAccess
 Test Files  1 passed (1)
 Tests  16 passed (16)
```
+3 cases lock the decision, including the regression: a locked non-member holds and is NEVER redirected to the
hub. Full gate + exit code in closure.md.
