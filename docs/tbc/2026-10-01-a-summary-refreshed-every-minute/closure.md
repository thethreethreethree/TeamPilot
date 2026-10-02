# CLOSURE - a summary refreshed every minute

## What is true now

A refreshed rep summary records when it was written, so the every-minute job stops refreshing a rep once their
summary is newer than their latest pitch. The duplicate project that ran every job twice is gone.

## Residual

```json
[
  {
    "id": "R1-other-default-only-freshness",
    "item": "Other upserted tables may have a freshness column set only by DEFAULT and read by a gate.",
    "why_skipped": "This fix first, because it was spending money every minute; the sweep pattern is in check.md.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-01T19:50:00Z",
    "outcome": "OPEN."
  },
  {
    "id": "R2-cron-seen-healthy",
    "item": "The cron finishing in under a second again, after this deploys, has not been observed yet.",
    "why_skipped": "Needs the deploy.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-01T19:50:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Residual update (appended 2026-10-02T04:25Z)

- **R1-other-default-only-freshness: CLOSED, none found.** Swept every `.upsert(` under src (30 sites) and every
  skip-if-fresh gate (`isStale|isFresh|isDue|Due(|olderThan|STALE_|FRESH`). The other gates decide by `status`,
  `checked_at` or `started_at`, each written explicitly on the write that changes it. rollupDueReps was the only
  gate reading a timestamp that only a column DEFAULT set.
- **R2-cron-seen-healthy: CLOSED.** 2026-10-02 03:48Z to 03:57Z, pitch-processing-cron answered 200 every minute
  (Vercel logs), after DeepSeek recovered. rep_pattern_summaries updates were 14,142 at 19:5xZ and at 03:57Z:
  no rewrites in between.
