# CHECK — capture-health customer-missing widening

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings
No findings — this is an additive metric widening (a new disjoint bucket), not a change to existing counts or a
defect fix. The derivation is locked by the route test.

Correctness checks performed:
- `customerMissing` is disjoint from `noFeedback`: a session with an agent segment is `continue`d out of the
  0-agent population, so it can only land in `customerMissing` (if customer absent) or "captured fine" (if
  present) — never double-counted. The route test asserts this (noFeedback stays 3; customerMissing is 1).
- The signal matches the auto-recover trigger: `withAgentSegment && !withCustomerSegment` is the segment-level
  equivalent of `computeTalkRatio`'s `custW===0 && repW>0` caveat.
sweep-command: `grep -n "withCustomerSegment\|customerMissing" src/app/api/coach/sales-session/capture-health/route.ts`
— confirms the set is tracked and the bucket is derived + returned.

## Tests
```
$ npx vitest run src/app/api/coach/sales-session/capture-health/__tests__/route.test.ts
 Test Files  1 passed (1)   ·   Tests  4 passed (4)
```
The full gate result (typecheck/lint/audits/tbc/tests + exit code) is in closure.md.
