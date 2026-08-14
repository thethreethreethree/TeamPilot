# CLOSURE — live-STT token mint capacity classification

## What shipped
Answering the founder's concurrency question with a concrete hardening: the live-coaching STT token mint now
classifies its failure honestly. `mintRealtimeSttToken` attaches the HTTP status; `/realtime-token` returns a
distinct, actionable message per cause — 429 (too many sessions starting at once, under concurrent load) → 503
`{retryable:true}` "busy, wait a few seconds and try again"; 402/403 (account quota/billing) → 502
`{retryable:false}` "temporarily unavailable on this account"; else the generic couldn't-start. Every branch
still points at the Upload-recording fallback, so a transcript is never lost.

This closes the token-mint (rate-limit) instance of the provider-capacity-under-concurrency class. The
concurrent-STREAM cap (at the browser wss) is a separate, flagged follow-up.

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-realtime-token-capacity-classification)
typecheck ✓ · lint ✓ · theme-leak audit — leaks: 0 ✓
RLS audit ✓ · Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
Test Files  417 passed | 1 skipped (418)
     Tests  2891 passed | 15 skipped (2906)
exit 0
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "The ElevenLabs concurrent-STREAM cap at the browser wss is NOT handled — a rejected stream could still silently capture nothing under high concurrency.", "why_skipped": "Different layer (the client wss, not the token mint); needs the real provider wss-rejection shape + touches the delicate live-coaching client. Flagged for a dedicated, founder-gated build rather than guessed (§5).", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-14T09:12:00Z", "outcome": "Flagged to the founder as the next concurrency build." },
  { "id": "R2", "item": "No per-tenant/global session cap or per-tenant cost cap yet — nothing throttles concurrent load before it hits the provider ceiling.", "why_skipped": "Session cap is a listed future task; the cost cap is gated on the founder's AI-COST-CAP numbers.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T09:12:30Z", "outcome": "Flagged." },
  { "id": "R3", "item": "Clock-drift artifact: started_at 09:00Z is ahead of the real clock (~02:00Z) to sort newest for the TBC dir-selector.", "why_skipped": "Ordering is honest; only the absolute value tracks the session's drifted clock. Documented in the reference_tbc_build_dir memory.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T09:13:00Z", "outcome": "Noted." }
]
```

## Un-named reliance
- Relies on ElevenLabs returning 429 for a per-minute token-request rate limit and 402/403 for an account
  quota/billing/plan limit (the statuses `describeElevenLabsAuthError` already classifies for the other ops).

## Status
Complete once the gate shows exit 0. A busy-hour token-mint blip now reads as "busy, try again" (retryable), an
account limit reads as such, and neither pretends to be the other. The concurrent-stream cap remains flagged.
