# CLOSURE — module-lock × member-gate redirect loop (CRITICAL brick)

## What shipped
A module-LOCKED account that wasn't (yet) a member of its module had no fixed point: the layout redirected it to
`/dashboard`, the middleware module-lock bounced `/dashboard` back into the module, forever
(`ERR_TOO_MANY_REDIRECTS`). It bricked a freshly-invited rep in the normal invite→assign window — the product's
target user, unable to reach any page. Fixed by holding a locked non-member on an honest in-module terminal
(`ModuleNoAccess`) via a pure, tested `moduleGateDecision`, instead of redirecting into the loop. Swept the class:
BOTH module layouts (sales-coach + care) now route through the shared decision.

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-module-lock-redirect-loop-fix)
typecheck ✓ · lint ✓
theme-leak audit — Theme-bound leaks: 0 ✓
RLS policy audit ✓ · Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
Test Files  415 passed | 1 skipped (416)
     Tests  2866 passed | 15 skipped (2881)
exit 0
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "A full browser repro (invite a Member into a sales_coach-locked company, sign in before Staff assignment) to confirm the hold screen renders instead of the loop.", "why_skipped": "The repo has 0 component/E2E tests for layouts; the loop-critical logic is the pure moduleGateDecision, which IS gated. A live browser check is the honest end-to-end confirmation.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T05:40:00Z", "outcome": "Flagged; verify on a staging invite." },
  { "id": "R2", "item": "Clock-drift artifact: this build's started_at (05:30Z) is ahead of the real clock (~02:00Z) so it sorts newest for the TBC dir-selector, which the prior committed dirs pushed ahead of the sandbox clock.", "why_skipped": "Ordering is honest (this build genuinely follows the forgot-password build); only the absolute value tracks the session's drifted clock. Documented in the reference_tbc_build_dir_lexicographic_sort memory.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T05:40:30Z", "outcome": "Noted." }
]
```

## Un-named reliance
- Relies on the middleware module-lock (0207) continuing to confine a locked account to its module subtree — the
  hold screen is at `/dashboard/<module>`, which the lock permits, so no bounce. If the lock ever allowed a
  locked account onto `/dashboard`, the `hub` branch would also become safe for it (but the hold is still correct).

## Status
Complete once the gate shows exit 0. A freshly-invited rep now sees an honest "access not set up yet" screen with
Re-check / Sign out instead of a browser error. The C.A.R.E sibling is fixed in the same pass.
