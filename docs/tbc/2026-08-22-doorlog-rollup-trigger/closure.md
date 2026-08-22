# CLOSURE — Next Door focus: durable rollup trigger + backfill

## What shipped
The Next Door focus (+ Opportunities to grow) never generated because its data source,
`rep_pattern_summaries`, was empty — the rollup ran ONLY via the cron's fragile "rollup pass", which never
populated the table while pitches completed via the route's `after()` kick, and its failure was swallowed
silently. Proven the LLM/data/write are all sound (reproduced the exact call → valid JSON). Fixes:

1. **Durable trigger:** the worker kicks `rollupRep` from the pitch-completion path via `after()` — fires on
   every completion, not only the cron pass (which remains a backstop). This is the "never again".
2. **Visibility:** the rollup's swallowed per-period catch now logs.
3. **Backfill (founder-authorized):** ran the rollup for all 4 reps with complete pitches → 16 summaries →
   the focus + opportunities now render for existing data. Score Chart (v2 score dims) + Pitch Performance
   (42 summaries) were verified already populated.

Full `npm run check` exit 0.

## The un-named reliance
- **`after()` firing in the route/cron context.** The kick relies on Next's `after()` (the same mechanism that
  reliably kicks pitch processing). If a runtime ever fails to run it, the cron `rollupDueReps` pass is the
  backstop, and the completion still succeeds. On-device/prod confirmation: after a rep completes a new pitch
  (once the recording fixes reach them), the Next Door focus should refresh without the cron.
- The backfill used the rollup prompt without the per-company brain composition (a faithful reproduction, proven
  valid); a later cron/completion run re-generates with full brain grounding (idempotent upsert).

## Residual (A36)

```json
[
  {
    "id": "cron-rollup-pass-root-not-independently-confirmed",
    "item": "The exact reason the CRON's rollup pass never populated (cron not firing vs erroring) was not independently confirmed — I lack prod cron/log access (no CRON_SECRET locally).",
    "why_skipped": "The completion-path kick makes the rollup fire regardless of the cron's health, so pinning the cron's specific fault is no longer on the critical path; the cron remains an idempotent backstop.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T08:34:00+08:00",
    "outcome": "Made the trigger robust instead of depending on the opaque cron; visibility added so a future rollup failure is no longer silent."
  },
  {
    "id": "v1-pitches-missing-two-score-dims",
    "item": "10 of 42 analyses are v1-rubric (missing talk_listen/questions); their scores contribute nothing to those two Score Chart dimensions.",
    "why_skipped": "The Score Chart averages whichever dims a period's pitches carry, so it populates from the 32 v2 pitches; re-analyzing the 10 v1 pitches is optional polish (R1), not empty content.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T08:34:00+08:00",
    "outcome": "Left as-is; the Score Chart is populated. A v1→v2 re-analysis backfill is available if the founder wants full dimension coverage on the old 10."
  }
]
```
