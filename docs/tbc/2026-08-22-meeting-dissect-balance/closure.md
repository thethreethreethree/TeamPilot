# CLOSURE — Speaker balance in the Dissect

## What shipped
`computeSpeakerBalance` (pure, tested) + its integration into the Dissect (type, generation, store payload,
review UI) — the plan's §3.1 imbalance monitor, realized post-hoc from the batch-diarized transcript (the live
coach can't ground it — A39). Word-share based, null below 2 speakers (§3.4), PROPOSED threshold. Full
`npm run check` exit 0 (3606 tests); no sales/server change. This completes the plan's meeting monitor set (the
two omitted-live monitors — imbalance here, agenda-timing/missing-updates still need meeting metadata from
Team-Sync).

## The un-named reliance
- **Diarization label accuracy.** The math is exact; whether ElevenLabs labels speakers correctly is the
  provider's concern (device/integration-confirmed).
- **Founder sign-off** on balance as a measured field + the DOMINANCE_PCT threshold (proposed).

## Open
1. Founder sign-off on the proposed measurement (now including balance) + trend heuristic.
2. Nav placement (Team-Sync); the two remaining monitors need Team-Sync meeting metadata (agenda, roster).

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "balance-not-in-trend",
    "item": "Balance is a displayed dissect field but does NOT feed the improvement-trend (which uses owned-action + focused ratios).",
    "why_skipped": "The trend's direction reads two MONOTONIC-good ratios; adding a third signal (balance) is a measurement-weighting change the founder is reviewing, so it's shown per-meeting but not yet folded into the trend direction.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T03:05:00+08:00",
    "outcome": "Examined: balance IS monotonic-good (more balanced = better), so it COULD join the trend ratios — but changing the direction heuristic is exactly what's flagged for founder sign-off, so adding balance to it now would pre-empt that review. Shown per-meeting (immediately useful); folding it into the trend is a one-line add in aggregateMeetingDissects once the founder confirms the measurement set. Deliberately deferred to that sign-off, not an oversight."
  }
]
```
