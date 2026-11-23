# CHECK - Count every sign-in in team usage

## Commands

```
node scratchpad/authlog.mjs (production, counts) → auth.audit_log_entries actions (30d): [] · login_attempts succeeded (30d): 2
node scratchpad/authsess.mjs (production, counts) → auth.sessions created (30d): 5, users 3 · identities: email 28
npx vitest run usage.test.ts usage route → 9 passed (a form record + its session = 1; a session alone = 1; a form record whose session was removed = 1; mobile sign-in counts; failed read 500; company + people only)
npm run db:apply → applied 0327 · DB now at 0327 · ✅ ALL 33 invariants hold
node scratchpad/check0327.mjs (production) → authenticated false · service_role true · companies with sign-ins (30d): {sessions 4, passwords 2}, {sessions 1, passwords 0}
npm run invariant:audit → first ✗ "stale service-role tenant exception" (the login_attempts read moved into the function) → entry removed → Violations 0
```

## Findings

### F1 - the usage view counted only web-form sign-ins
class: a metric read from one of several sources of the same event.
sweep: sources of a sign-in in this project — login_attempts (web form), auth.sessions (every method, removed on
sign-out), auth.audit_log_entries (empty here). Both non-empty ones are now read.
severity: medium

## Final

```
npm run check → exit 0 · Test Files 902 passed | 1 skipped · Tests 6672 passed | 15 skipped
```
