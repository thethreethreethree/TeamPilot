# CLOSURE — speed-of-speech feedback now has the timing it needs, read as true tempo

The 9/2 "speed of speech feedback not appearing" is resolved by fixing the real root cause (the timing was
never captured), not by building a new metric the codebase already had:

1. The live client now stamps each turn's `spokenAt` and persists it, so `agentWpm` has data for new sessions.
2. `agentWpm` now measures true speaking tempo (per-turn median), so the activated "speed" skill is meaningful
   rather than a throughput figure that mislabels good listeners as slow.
3. The same timestamps light up the call timeline / moments / pivot as a bonus.

## What this build does NOT do (un-named-reliance half)
- OLD sessions stay unpaced — no stored timing to recover; pace lights up for NEW sessions as they accrue.
- `spokenAt` is per-utterance-START, not word-level, so per-turn duration (gap to the next timed segment) is an
  approximation; the plausible-rate filter + median make it honest, not exact.
- The live-cue pace path (`liveStress`) is unchanged; this build only surfaces the AFTER-pitch/aggregate pace.
- Reynolds' separate "server migration" work is not touched.

## Residual (A36 — read from the TOP of the confidence ranking)
```json
[
  { "id": "R1-timeline-benefit-verified",
    "item": "Whether capturing spokenAt actually lights up the call timeline/moments/pivot, or just the pace skill.",
    "why_skipped": "Assumed the timeline was a separate concern from the pace fix — the thing I was most sure didn't matter to this build.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-09T14:22:00+08:00",
    "outcome": "OPENED and confirmed worth it. salesMoments.ts:186, salesPivot.ts:190, afterPitch.ts:118 all read s.spokenAt behind `if (s.spokenAt)` guards to build the relative timeline origin. With spokenAt null they silently ran in no-timestamp mode; now they get real per-turn offsets. So this build fixes MORE than the pace skill — the call timeline gains real timing for new sessions, at no extra cost. Stronger result than filed." },
  { "id": "R2-old-sessions-unpaced",
    "item": "Existing sessions have no stored spokenAt, so their pace can never be computed.",
    "why_skipped": "Founder chose the live-capture path knowing it's forward-only; re-transcription backfill was the option NOT taken.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null },
  { "id": "R3-approx-duration",
    "item": "Per-turn duration is the gap to the next timed segment, which includes any pause — approximate.",
    "why_skipped": "The plausible-rate filter (60–320) discards pause-dominated turns and the median is robust to the rest; exactness isn't achievable without word-level timestamps.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null }
]
```

## Verification
See check.md — `npm run check` run whole with pasted output + exit code, plus the agentWpm throughput-regression
gate mutation-checked, plus the persist-seam forwarding test.
