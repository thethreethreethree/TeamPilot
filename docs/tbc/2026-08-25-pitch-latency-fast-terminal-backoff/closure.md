# CLOSURE — cut after-pitch latency: fast-terminal permanent failures + shorter retry backoff

## What shipped
Permanent pitch failures (bad audio content / missing brain-company config) now terminalise on the first attempt
instead of churning the full ~15-min retry backoff, and the transient backoff base drops 30s→7s so a genuine hiccup
recovers in seconds. Grounded in the measured latency (median ~30s; the ~11-min average was failure churn, and 4 of
14 failures were permanent config errors retried 5×).

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Targeted: retryBackoff + worker suites green incl. the new
isPermanentFailure branches + the terminal-vs-backoff worker cases.

## The un-named reliance
- **A 400 "invalid_audio/corrupted" from ElevenLabs is a content verdict, not a transient blip.** The classifier
  treats it as permanent, relying on the fact that (a) the empty-recording guard already stops empty audio before
  STT, so a reaching-STT rejection is a real bad-content 400, and (b) the in-call bad-concat recovery has already
  run. A genuinely transient provider error is a 5xx/timeout, which the classifier deliberately leaves transient.
  Pinned by the "5xx/timeout → isPermanentFailure=false" test.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Hours-long OUTLIERS (complete max 191m, failed 218m) are NOT explained by the retry backoff (which caps at ~15min) — they point to pitch-processing-cron execution GAPS.",
    "why_skipped": "Confirming cron cadence needs the Vercel cron execution logs, which are not available headlessly. This fix targets the retry-churn cause (the bulk of the inflated average); the cron-gap tail is a separate, data-gated investigation surfaced to the founder as the next lever.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-25T11:58:00+08:00",
    "outcome": "OPENED + bounded: the retry backoff can add at most ~15min (5 attempts, base 7s now, previously 30s → ~15min), so any latency >~20min is NOT retry churn — it is queue/cron wait. That means this fix cannot regress the outliers and the outlier cause is provably elsewhere (cron execution). Recorded as the next founder-gated lever (pull Vercel cron logs / verify the every-minute schedule fires); not fixable from the code alone."
  },
  {
    "id": "R2",
    "item": "isPermanentFailure matches on error-message substrings, which could drift if an upstream error wording changes.",
    "why_skipped": "The matched phrases are the provider's stable 400 codes (invalid_audio/invalid_content) and our own thrown config messages (no brain row / company not found) — both under our or ElevenLabs' stable control. A drift would only make a permanent error fall back to the (safe) transient retry path, never the reverse (a transient error is never matched). So drift degrades to the old behavior, never to killing a recoverable pitch.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
