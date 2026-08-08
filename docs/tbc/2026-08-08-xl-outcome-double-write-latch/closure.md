# CLOSURE — recordOutcome double-write latch

## What shipped
A `useRef` re-entrancy latch on `recordOutcome` (the chokepoint every outcome-event append routes through),
closing an append-only double-write sibling the earlier fix (`submitWhy`/`generateReview` latches) left unswept.
A fast double-click can no longer append two identical `coach.session_outcome_recorded` §3.1 events. Client-side
fix; mirrors the codebase's established pattern.

## Un-named-reliance check
The latch is a CLIENT guard: it stops the double-fire from THIS component, but a direct API double-POST, a
service-role caller, or a future component would still append duplicate outcome events — the server does not
enforce it. That reliance is NAMED, not hidden: the real gate is a server chokepoint (idempotency in
`setSessionOutcome`), which is a §3.1 append-only-semantics decision the founder owns (does the event model
dedupe identical events, or is a second identical event a legitimate re-record?). Flagged below as the residual.

## Residuals
```json
[
  {
    "id": "R1-server-chokepoint-idempotency",
    "item": "The precise gate is server-side idempotency in setSessionOutcome (dedupe an identical outcome event within a short window / on a request id), not a client useRef latch. Not built.",
    "why_skipped": "It changes §3.1 append-only event semantics (is a second identical outcome event a bug or a legitimate re-record?) — a founder/architecture decision, not a bug fix. The client latch matches the codebase's established pattern for this class and closes the realistic double-click case now.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-08T07:30:00Z",
    "outcome": "OPENED and flagged to the founder. Traced this build: the client latch closes the double-CLICK path (the actual reported class); the residual risk is a direct/service-role double-POST, which requires the founder's call on whether the events table should dedupe identical outcome events (and applies equally to the why/review latches — same class, same client-only posture). Recommend: if outcome-event COUNT ever feeds a downstream-consequence (KPI) metric, add server dedupe; if metrics read the idempotent column, the client latch suffices. Not picking the architecture unilaterally."
  },
  {
    "id": "R2-latch-runtime-unproven",
    "item": "The latch is UI re-entrancy behavior, unproven in the node test env (no DOM); confirmed only by typecheck + code-read + mirroring the live whySubmitRef pattern.",
    "why_skipped": "Component/DOM rendering isn't available in vitest-node; the existing latches ship under the same posture.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-08T07:30:30Z",
    "outcome": "OPENED and resolved: the fix is a verbatim copy of the whySubmitRef/reviewSubmitRef latch already live in the same file (checked+set before first await, released in finally); typecheck clean; the re-entrancy logic is trivially correct by inspection. Runtime pixels are the founder's live-confirm, bounded to 'one component's double-click guard'."
  }
]
```
