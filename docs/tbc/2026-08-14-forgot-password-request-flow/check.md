# CHECK — password-recovery REQUEST flow

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — recovery flow had no request entry point (half-built: room, no door)
file+line: `src/app/login/page.tsx` + `src/app/sales-coach/login/page.tsx` (no "Forgot password?" control) vs
`src/app/auth/recover/page.tsx` (a complete completion page that nothing routes to).
class: missing-surface / workflow-continuity (§1.5.1 layer-3 — a feature internally correct but unreachable, so
the user stalls in a dead end).
severity: medium (a user who forgets their password has no self-serve path; requires manual admin reset — which
is exactly what happened for sanpedrodf@gmail.com this session).
sweep-command: `grep -rn "resetPasswordForEmail" src` — was 0 hits before this build (request side absent);
now resolves in `src/app/auth/forgot/page.tsx`, reached by a "Forgot password?" link on BOTH login surfaces.
read-path: fixed — the new `/auth/forgot` page + the helper + the two links make the completion page reachable.

## Class sweep (A26)
The founder named "a Forgot Password option" generically. Swept BOTH login surfaces, not just the main one: the
main ELOSTATE login (`/login`) and the Sales Coach login (`/sales-coach/login`) — whose own hint text said
"reset it from the main ELOSTATE sign-in", a link that also did not exist — both now carry the entry.

## Tests
```
$ npx vitest run passwordRecovery
 Test Files  1 passed (1)
 Tests  6 passed (6)
```
The suite locks the redirect construction, the recover-page disk-existence drift-guard, the email check, and the
anti-enumeration message. Full gate + exit code in closure.md.
