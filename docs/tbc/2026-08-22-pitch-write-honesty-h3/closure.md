# CLOSURE — Pitch worker: derived-table write honesty (audit H3)

## What shipped
The Macro Mode pitch pipeline can no longer present a lost write as a finished pitch. `writePitchTranscript`,
`writePitchAnalysis`, and `setPitchStatus` now THROW on a Supabase error instead of swallowing it, so a transient
write failure routes into the worker's retry → honest terminal `failed` rather than a `complete` pitch with no
analysis row. The worker keeps its "never throws" contract via a best-effort `recordFailureStatus` on its failure
paths. `PitchDetail` shows a truthful "Analysis unavailable" (with the transcript) for any `complete`-without-
analysis row instead of an unresolvable "Still processing…". No schema change, no migration. Full `npm run check`
exit 0.

This closes audit finding **H3** and completes **Bundle A** (H1 `d9160efe` · H2 `6453218b` · H3 this commit).

## The un-named reliance
- **Idempotent upserts.** A retried transcript/analysis write overwrites cleanly — relied on so a mid-pipeline
  failure + retry doesn't duplicate rows.
- **Cron liveness + lease.** Recovery from a failed write is a retry on the next claim; relies on the per-minute
  pitch cron (registered in `vercel.json`).
- **The complete-without-analysis UI branch is for LEGACY/edge rows.** The root fix prevents new ones; that row is
  NOT auto-regenerated (status `complete` is terminal, not re-claimable), so the copy makes no false auto-fix
  promise.

## Residual (A36)

```json
[
  {
    "id": "h3-legacy-complete-without-analysis-not-auto-healed",
    "item": "A pre-existing complete-without-analysis pitch (from before this fix) shows honest 'Analysis unavailable' but is not auto-regenerated (terminal status is not re-claimable).",
    "why_skipped": "Unknown whether any such rows exist; a backfill/repair pass is a separate, bounded task and the honest UI already prevents the falsehood. No false promise is made to the rep.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T14:50:00+08:00",
    "outcome": "Surface is honest; a repair sweep can be run if such rows are found."
  },
  {
    "id": "h4-m4-remaining-audit-findings",
    "item": "H4 + M4 (meeting Dissect caches a transient failure permanently; unconditional 'saving now' copy) remain — the meeting bundle (audit Bundle C).",
    "why_skipped": "Different root shape (a backoff marker written for ANY non-success); ships as its own verified bundle.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-22T14:50:00+08:00",
    "outcome": "Tracked in docs/RELIABILITY-AUDIT-2026-08-22.md."
  }
]
```
