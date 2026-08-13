# BUILD — STT-capture instrumentation

### Per-session capture log (real-time signal)
read-path: `src/lib/coach/v5/afterPitch.ts` `generateAfterPitchSummary` loads `segments` via
`getSessionTranscriptAdmin`. write-path: emits a `console.log("[stt-capture] …")` with sessionId, companyId,
context, `segments`, `agentTurns`, `customerTurns`, `empty`, `oneSided` (segments>0 && agentTurns===0), right
before the `segments.length===0` EMPTY short-circuit. Logging only — no return/behavior change; a one-sided
recording still returns its (blank-narrative) summary exactly as before.

### capture-health — measure the TRUE no-feedback population + per agent
read-path: `src/app/api/coach/sales-session/capture-health/route.ts` now selects `agent_id` on the ended
sessions and `speaker` on the segments, and builds two sets (withAnySegment, withAgentSegment) + a per-agent
tally. write-path: response gains `noFeedback` (0 agent turns = empty OR one-sided), `oneSided`, `noFeedbackRate`,
and `byAgent[]` (agentId, ended, noFeedback, oneSided, empty, rate — sorted worst-first). Legacy `failed`
(no-transcript) + `failureRate` retained. The paged/honest-count discipline (exact head total, fetchAllPaged
with backstop, §3.4 error state) is unchanged.

### Settings UI surfaces it
read-path: `src/app/dashboard/sales-coach/settings/page.tsx` `CaptureHealthCard` fetches `/capture-health`.
write-path: renders no-feedback (true cost), one-sided, empty, recoverable, lost, and a "most-affected agents"
list (worst no-feedback rate first) so a manager can spot a device/mic capture problem by agent.

## Test coverage
`capture-health/__tests__/route.test.ts` updated: mock segments carry `speaker`, ended carry `agent_id`; asserts
the empty/one-sided split, the true noFeedback count, and the per-agent rates (worst-first ordering).
