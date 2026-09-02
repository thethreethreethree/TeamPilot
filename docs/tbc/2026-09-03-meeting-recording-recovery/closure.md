# CLOSURE — long-meeting recording recovery + durable fix

## What shipped
Long-session recordings were silently unrecoverable: the durable stitch failed on TWO limits only long sessions
cross — the 25 MB `assets-v1` bucket cap (a 41-min meeting is ~37 MB) and the ~145s sequential chunk download
(killed the in-request self-heal under the 300s cap). Fix: raise the bucket cap to 250 MB (0241) and parallelize
the stitch download (145s → ~3s), so both the meeting-review self-heal and the stale-close cron finish in budget.
Recovered the 3 meetings already lost — the founder's ("9/2 JOHN RAMOS.", transcription-verified: 34s, 37k chars,
4 speakers) plus "Monday Focus" and "Meeting 1".

## Verification (A38)
`npm run db:apply` → 30/30 invariants. `npm run typecheck` clean. 24/24 vitest (19 stitch semantics + 5 cron).
The recovered audio was actually transcribed via ElevenLabs (34s, real 41-min content) BEFORE reporting fixed —
proof, not assertion. All pasted in check.md.

## The un-named reliance
- Relies on the meeting-dissect route's existing on-demand self-heal (stitch-when-audio_asset_url-null) to recover
  FUTURE long sessions on first review — now that it fits the budget. New sessions are not proactively stitched.
- Relies on ElevenLabs Scribe accepting a 37–41 MB webm (verified for the founder's file).

## Residual (A36 — explicit)
```json
[
  {
    "id": "REC-R1",
    "item": "Recovery of orphaned recordings is a lazy self-heal (first review) + a manual backfill script, not a proactive cron. A session captured but never reviewed stays unstitched until someone opens it.",
    "why_skipped": "The deployed size+parallel fix makes the self-heal succeed in-budget, so no data is lost — only deferred to first view. A proactive stitch-orphans cron is a clean follow-up, not required to close the outage.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T07:44:00+08:00",
    "outcome": "OPEN — add a stitch-orphaned-recordings cron (mirror backfill-dissects-cron) if orphans recur."
  },
  {
    "id": "REC-R2",
    "item": "Deploy status not yet confirmed — the local gate passed but the Vercel deploy of the stitchSessionAudio change must be verified (local pass does not equal deployed).",
    "why_skipped": "Verified after push.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-03T07:44:00+08:00",
    "outcome": "OPEN — confirm /api/health build.commit == HEAD after push."
  }
]
```
