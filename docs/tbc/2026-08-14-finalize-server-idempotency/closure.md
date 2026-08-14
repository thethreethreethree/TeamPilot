# CLOSURE — /finalize server-side idempotency

## What shipped
`/finalize` ran the five post-call LLM engines UNCONDITIONALLY — guarded only by the client `finalizedRef` (per
mount) — so a second POST (a 2nd tab, a retry, a future caller) re-charged all five DeepSeek engines. It now
skips regeneration when the `coach.dissect_generated` marker already exists (the same marker the backfill cron
keys on), appending the transcript (idempotent) and returning `{ alreadyGenerated: true }` instead. A failed
first generation leaves no marker, so a legitimate retry still runs. Mirrors `/label-transcript`'s server gate.

Deferred (flagged, needs its own build): `/retranscribe` server idempotency — a different mechanism (its
diarization result is ephemeral + it is re-runnable by design), so its de-dup needs new persisted state (a cached
result or a per-session auto-fire marker = a migration).

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-finalize-server-idempotency)
typecheck ✓ · lint ✓
theme-leak audit — Theme-bound leaks: 0 ✓
RLS policy audit ✓ · Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
Test Files  415 passed | 1 skipped (416)
     Tests  2871 passed | 15 skipped (2886)
exit 0
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "Finding ④ (retranscribe re-charges a full STT diarization on reload / 2nd tab / on-mount auto-fire) remains open.", "why_skipped": "Needs new persisted state (cached diarization result or a per-session auto-fire marker column = a migration); not rushed into a cost path this deep in a long session. Founder selected the cluster — this is the honest remainder for a dedicated build.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-14T07:12:00Z", "outcome": "Flagged to the founder as the next spend build." },
  { "id": "R2", "item": "Clock-drift artifact: started_at 07:00Z is ahead of the real clock (~02:00Z) to sort newest for the TBC dir-selector.", "why_skipped": "Ordering is honest; only the absolute value tracks the session's drifted clock. Documented in the reference_tbc_build_dir memory.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T07:12:30Z", "outcome": "Noted." }
]
```

## Un-named reliance
- Relies on `generateSessionArtifacts` appending the `coach.dissect_generated` event on a successful dissect (the
  marker this guard reads), and on that event being readable by the owner via RLS (the dashboard reads events the
  same way).

## Status
Complete once the gate shows exit 0. A repeat finalize no longer re-charges the five engines; retranscribe
idempotency remains flagged for the next spend build.
