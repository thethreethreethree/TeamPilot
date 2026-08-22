# CLOSURE — Meeting Dissect: transient self-heal (audit H4)

## What shipped
The meeting Dissect no longer caches a transient failure as a permanent empty review. `generateMeetingDissect`
now classifies its outcome (`signal` / `empty` / `transient`); only a GENUINE thin meeting (LLM ran + parsed +
found nothing, or zero segments) writes the `dissect_attempted` backoff marker. A TRANSIENT failure (empty LLM
text / unparseable-or-array JSON / a throw / control-suppressed) writes NO marker, so the route re-transcribes and
retries on the next view and self-heals — and returns an honest 503 `{ retryable: true }` that surfaces in the
existing "didn't generate — try again" state instead of a silent empty. The captured meeting content is no longer
lost to a one-off token-starvation. No schema change; the `MeetingReview` UI needed none (its error+Retry seam
already fit). Full `npm run check` exit 0.

This closes audit finding **H4** — the last HIGH-severity finding. Remaining audit work is MED/LOW (Bundle B
DoorLog residuals M1-M3, Bundle C's M4, Bundle D L1-L2).

## The un-named reliance
- **Self-heal is view-driven.** Recovery happens the next time a user opens the review (which re-transcribes) —
  there is no meeting backfill cron (unlike sales). Acceptable: the review is a user-pull surface, and the 503 +
  Retry makes recovery a one-tap action. A future meeting backfill cron would make it automatic.
- **Cost bound.** A persistently-transient meeting re-transcribes on each view; bounded by the route's rate limit
  (12/min) and that it's user-driven, not an automated loop. The common one-off blip self-heals on the very next
  view and then caches the durable generated event.

## Residual (A36)

```json
[
  {
    "id": "h4-legacy-no_signal-markers-not-reclassifiable",
    "item": "dissect_attempted markers written BEFORE this change (transient failures recorded as reason no_signal) stay treated as permanent empty.",
    "why_skipped": "Retroactively indistinguishable from a genuine thin meeting; ?force=1 recovers any that mattered. A one-time repair pass could clear markers on sessions whose audio yields signal.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T15:50:00+08:00",
    "outcome": "New failures self-heal; legacy ones recover via force."
  },
  {
    "id": "h4-no-meeting-backfill-cron",
    "item": "Self-heal is view-driven; there is no meeting-dissect backfill cron to regenerate unattended.",
    "why_skipped": "The review is a user-pull surface; the 503+Retry + no-marker retry covers the interactive case. A backfill cron is a separate enhancement.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T15:50:00+08:00",
    "outcome": "Interactive self-heal shipped; automatic backfill deferred."
  },
  {
    "id": "remaining-audit-med-low",
    "item": "Bundle B (M1-M3 DoorLog residuals), Bundle C's M4 (meeting Stop optimistic copy), Bundle D (L1-L2) remain.",
    "why_skipped": "MED/LOW; each ships as its own verified bundle. All HIGHs (H1-H4) are now closed.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T15:50:00+08:00",
    "outcome": "Tracked in docs/RELIABILITY-AUDIT-2026-08-22.md."
  }
]
```
