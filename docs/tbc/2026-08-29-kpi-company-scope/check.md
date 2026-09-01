# CHECK — company-aggregate KPI scope

## Gate — the canonical command (A38)
```
$ npm run check   # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:* — pass
> test   Test Files 595 passed | 1 skipped ; Tests 3938+ (unchanged suite)
PIPE_EXIT=0
```

## Live-DB verification — the fix produces real numbers (not a claim)
```
COMPANY-POOLED Layer-1 (MIN_SESSIONS=5):
 company c3e7…  opportunities 22 · resolved 13 · sold 9 · sold_with_value 0 · conversion 40.9%
 company 2820…  opportunities 14 · resolved 10 · sold 4 · sold_with_value 0 · conversion 28.6%
```
→ Conversion / Close / Win-loss cross the gate for the top 2 companies → they SHOW now.
→ Revenue + Avg-deal-size stay "building" (sold_with_value = 0) — HONEST (no deal values entered yet), not faked.

## What is / isn't tested
- Verified: the pooled data crosses MIN_SESSIONS (live-DB query above); typecheck clean.
- UNTESTED (founder-visual-verify): the route's scope branch + the page toggle (no me-route/page jsdom harness).
  The compute is the already-tested compute.ts; only the row-set scope + the admin gate are new. RLS same-company
  read is the existing policy the team route relies on.

## Findings
No findings. Reuses the tested compute; company-scope is admin-gated with a self fallback; revenue honesty preserved.
