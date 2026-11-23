# CHECK - Team usage

## Commands

```
npx vitest run src/lib/coach/remote/__tests__/usage.test.ts → 3 passed · src/app/api/coach/remote/usage → 4 passed, exit 0
npm run check → first run: ✗ service-role statement names no tenant (usage/route.ts::login_attempts::email) → allowlisted with the reason;
npm run check → exit 0 · Test Files 867 passed | 1 skipped · Tests 6515 passed | 15 skipped
```

## Findings

### F1 - sign-ins only count the email-and-password form
class: a usage source that sees one door of several.
sweep: `grep -rln "login_attempts" src/app/api` → only /api/auth/sign-in writes it; OAuth and mobile sign-ins don't.
severity: low

### F2 - one admin user lookup per person for sign-ins
class: N calls to the auth admin API per page load.
sweep: `grep -n "getUserById" src/app/api/coach/remote/usage/route.ts` → one per visible member; rate-limited 20/min.
severity: low
