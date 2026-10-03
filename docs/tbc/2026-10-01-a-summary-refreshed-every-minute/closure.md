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

## Verified end to end (appended 2026-10-03T05:10Z)

The founder approved re-queueing 9 pitches failed in the September outage (docs/ops/2026-09-25-...sql). That is
the first real traffic through the rollup since the fix, and it is exactly the case that looped: completed
pitches newer than the rep's summary. Production, read-only, once a minute:

```
05:02:33  recorded 9            summary updates 14142  newest summary 2026-09-30 20:09:10
05:03:34  complete 6, recorded 3                14142                2026-09-30 20:09:10
05:04:36  complete 9                            14144                2026-10-03 05:04:33
05:05:37  complete 9                            14167                2026-10-03 05:05:35
05:06:39  complete 9                            14173                2026-10-03 05:05:56
05:07:40  complete 9                            14173                2026-10-03 05:05:56
05:08:42  complete 9                            14173                2026-10-03 05:05:56
```

31 rewrites for the 9 completions, then none: the every-minute cron ran three more times and left the rep alone,
because their summary (05:05:56) is now newer than their latest pitch. Before cf7c722f this state meant about four
paid calls a minute. DeepSeek balance 6.60 -> 6.52 across the whole re-queue.
