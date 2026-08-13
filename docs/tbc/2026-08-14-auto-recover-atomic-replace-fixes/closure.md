# CLOSURE — atomic-replace + hardening fixes

## What shipped
An adversarial review of the same-day auto-recover build found a HIGH data-integrity bug plus four smaller
issues; all are remediated here. The recovery overwrite is now ATOMIC — `replace_session_transcript` (0212)
deletes + re-inserts a session's transcript in one transaction, so a mid-write failure rolls back and the
original (which, for auto-recover, holds real agent speech) always survives; the route returns `failed`, never
a false `recovered`. Both /auto-recover and /label-transcript's overwrite use it. Also: the heal no longer
fires alongside auto-recover (shared latch), cross-match declines on ambiguity (no inverted label), the marker
is released on transient STT failure, and video sessions are skipped.

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0 (0212 DEFINER fn is service_role-only → not client-callable)
tbc ✓ — docs · manifest · artifacts · residual · freshness
Test Files 411 passed | 1 skipped (412); Tests 2850 passed | 15 skipped (2865)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "The atomic overwrite leaves the transcript with seqs starting at 0 (the new set); no offset/renumber needed since consumers order by seq.", "why_skipped": "getSessionTranscript orders by seq ascending; contiguity/zero-start is not required. The RPC inserts the new seqs after a full delete, so no collision.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T01:35:00Z", "outcome": "By design." },
  { "id": "R2", "item": "Cross-match can still mislabel an over-segmented agent (agent split into a large + a small cluster; the small one becomes 'customer').", "why_skipped": "transcribeWithDiarization is called with numSpeakers:2, so 3+ clusters are unlikely; the separation guard covers the inversion (the higher-severity vector). The manual tap remains for the rest.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T01:35:30Z", "outcome": "Accepted; a decline-on-3+-clusters guard is the follow-up if it appears in practice." },
  { "id": "R3", "item": "F2's shared-latch fix is not covered by a render test (the page effect has no harness).", "why_skipped": "Consistent with the existing autoGen latch (also un-harnessed); the latch condition is a plain boolean guard.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T01:36:00Z", "outcome": "Accepted; covered by the condition + code review." }
]
```

## Un-named reliance
- The atomicity relies on "a plpgsql function body is atomic to its calling statement" — true in Postgres: an
  error anywhere in the function aborts the whole statement, rolling back the delete with the failed insert.
- ⑤ relies on "a video session's saved audio holds only the agent's voice" (mic is agent-only). True per the
  live attribution's isVideo hard override; if a future video mode captured both sides, the gate would need to
  follow it.

## Status
Complete once the gate shows exit 0 and migration 0212 is applied. The delete-then-append class that bit twice
is closed at the root by the atomic replace.
