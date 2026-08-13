# BUILD — capture-health customer-missing widening

### capture-health route: track the customer side + count the customer-missing class
read-path: `src/app/api/coach/sales-session/capture-health/route.ts` reads the ended sessions' segments and now
also builds a `withCustomerSegment` set.
write-path: none (read-only aggregate). New `customerMissing` counter (+ `customerMissingRate` + per-agent
`customerMissing`) for sessions where `withAgentSegment && !withCustomerSegment` — agent present, customer
absent (the blank-read-despite-scores class). Disjoint from `noFeedback` (0-agent). Name resolution widened to
include customer-missing-affected agents. Both the `total===0` early return and the main response carry the new
fields.

### capture-health card: surface the new bucket
read-path: `src/app/dashboard/sales-coach/settings/page.tsx` — `CaptureHealthData` / `CaptureHealthAgent`
types gain `customerMissing` (+ rate).
write-path: none. A new `Stat` ("Customer side missing (blank read despite scores)") renders the count + rate,
amber when > 0.

## Test coverage
`capture-health/__tests__/route.test.ts`: the split test now asserts `customerMissing===1` (s2, agent-only),
`customerMissingRate===20` (1/5), and per-agent A `customerMissing:1` — s2 is agent-present/customer-absent
while s1 (agent+customer) is two-sided and NOT counted. The honest-zero shape carries the new fields.
