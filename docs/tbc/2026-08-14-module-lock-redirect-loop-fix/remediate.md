# REMEDIATE — module-lock × member-gate redirect loop

## F1 — hold a locked non-member in-module instead of redirecting into the loop
Remediation: extracted the pure `moduleGateDecision(isMember, isLocked)` (`enter | hold | hub`) and a shared
`ModuleNoAccess` terminal. Both module layouts (sales-coach + care) now compute the lock first and branch: a
locked non-member `hold`s on the honest screen (Re-check / Sign out), a non-locked non-member still `hub`s to
`/dashboard`, a member enters. The middleware lock is untouched — the hold screen lives inside the module, so the
lock permits it and there is no bounce.
gate-or-promise: gate. `moduleAccess.test.ts` encodes the class: `moduleGateDecision(false, true) === "hold"` is
the regression case — re-introducing the `/dashboard` redirect for a locked non-member (the loop) fails CI.
class: workflow-continuity / auth-gate. severity: critical. Fixed (both modules).

## Note
The layouts themselves carry no component test (repo has 0 `*.test.tsx`); the loop-critical logic is the pure
decision, extracted precisely so the class is gated in the codebase's `src/lib/**/__tests__` style. A full
browser repro (invite a Member, sign in pre-assignment, observe the hold screen instead of the loop) is the
honest end-to-end confirmation and is noted as residual.
