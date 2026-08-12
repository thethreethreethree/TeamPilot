# BUILD — false-limit allowlist drift fix

## Feature inventory
### INVARIANT 21's guard restored on care/agent/analytics (stale allowlist entry removed)
- write-path: none (CI guard + a comment). N/A.
- read-path: INVARIANT 21 reads every non-test `src/**/*.ts(x)` file's raw text and, for each not in
  FALSE_LIMIT_ALLOWLIST, flags a `.limit(N>1000)` match. With `care/agent/analytics/route.ts` removed from the
  allowlist, that route is now READ by the guard again — so a re-introduced false limit surfaces as a finding
  instead of being skipped. Asserted by the detection test (re-added `.limit(5000)` → Violations: 1 on that
  file; reverted → 0). The route's fix-history comment was reworded off the literal `.limit(NNNN)` pattern so the
  restored read sees no false-positive on the comment.

## Files changed
- scripts/invariant-audit.mjs — remove the stale `care/agent/analytics` FALSE_LIMIT_ALLOWLIST entry + inline note.
- src/app/api/care/agent/analytics/route.ts — reword one comment ("`.limit(5000)`" → "5000-row cap") so the
  restored guard doesn't match the fix-history comment. No runtime change.

## Holistic (§1.5.1)
The other 5 allowlist entries (finance register, admin coach-readout, brain learning-summary, care.ts, KPI cron)
are UNTOUCHED — those false bounds are real + founder-gated ("fix the false limits"). Only the one genuinely-gone
bound is removed. No product/runtime behaviour changes.
