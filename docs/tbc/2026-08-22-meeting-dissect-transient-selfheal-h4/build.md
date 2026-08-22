# BUILD — Meeting Dissect: transient self-heal (audit H4)

### the dissect classifies its outcome, and only a GENUINE empty backs off
- write-path: `generateMeetingDissect` sets `outcome: "signal" | "empty" | "transient"` on every return branch.
  `generateAndStoreMeetingDissect` switches on it: **signal** → `dissect_generated` event; **empty** (LLM ran +
  parsed + no consequence, or zero segments) → `dissect_attempted` backoff marker (the ONLY no-signal that backs
  off — retains the cost-loop protection); **transient** (empty LLM text / unparseable-or-array JSON / throw /
  suppressed) → **NO marker written**, so nothing is cached and the next view retries.
- read-path: the dissect route, after generating, returns an honest **503 `{ dissect: null, retryable: true,
  error }`** for a transient outcome — which flows into `MeetingReview`'s existing error state ("didn't generate —
  try again" + Retry). On a later view, the absence of a cached marker makes the route re-transcribe + retry, and
  a success writes the durable `dissect_generated` event (self-heal). A genuine `empty` still shows the honest
  "this meeting didn't produce clear decisions" state, cached by its marker.

## Files
- `src/lib/coach/strategy/meeting/parseMeetingDissect.ts` — `DissectOutcome` type + `outcome` on `MeetingDissect`;
  parse-failure / array / non-object → `transient`; parsed-empty → `empty`; signal → `signal`.
- `src/lib/coach/strategy/meeting/generateMeetingDissect.ts` — set `outcome` on all branches; store switches on it
  (no marker for transient).
- `src/app/api/coach/meeting-session/[id]/dissect/route.ts` — 503 retryable response for a transient outcome.
- tests: `parseMeetingDissect.test.ts` (+1 outcome test; updated the malformed test for the new field);
  `generateAndStoreMeetingDissect.test.ts` (+3: no marker on empty-text / throw / unparseable).

## Ripple (§1.5)
No schema change (reuses the existing `events` markers with the same kinds/reasons). The `MeetingReview` UI needed
NO change — its error+Retry state already handles the 503. The sales dissect already self-heals (idempotency off
the success marker + backfill cron), so it was not touched.

## Honest limit / residual
LEGACY `dissect_attempted` markers written before this change (for transient failures, recorded as `no_signal`)
stay treated as permanent empty — indistinguishable retroactively; `?force=1` still recovers them.
