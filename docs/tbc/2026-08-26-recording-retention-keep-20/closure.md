# CLOSURE — recording retention: keep each rep's last 20

## What shipped
The recording-purge cron now keeps each rep's 20 most-recent recordings and purges only older ones, replacing the
delete-after-2-days rule. A rep who hasn't pitched in days still has a rolling window of recent recordings for the
manager to pull from — the exact gap the founder named. Every retention-integrity invariant is preserved (malformed
pointer guard, chunk cleanup, saved-recording exemption, transcript/scores kept, honest bounded flag); the candidate
query is cap-safe (fetchAllPaged).

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). 9 purge-cron tests pass across both files; typecheck clean.

## The un-named reliance
- **coaching_sessions carries a usable agent_id for grouping.** The count rule buckets by agent_id; a null agent_id
  (shouldn't occur for a real session) is given its own bucket so it can never merge into a real rep's window and
  cause an over-purge. Relied upon; the null-bucket fallback makes it safe if it ever happens.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The cron's schedule/activation (vercel.json + CRON_SECRET) is outside the repo; the change only takes effect on the scheduled runs.",
    "why_skipped": "The code is correct + tested; whether/when it runs is the existing external-config precondition (the vercel.json schedule + CRON_SECRET), unchanged by this edit — the founder's env already runs the purge (recordings were being deleted). No new external dependency introduced.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-26T10:06:00+08:00",
    "outcome": "OPENED + confirmed: this swaps the SELECTION rule inside an already-running cron; no new schedule/secret needed. The count rule takes over on the next scheduled tick."
  },
  {
    "id": "R2",
    "item": "This governs COACHING-session recordings (coaching_sessions.audio_asset_url). Door Log PITCH audio (pitches.audio_path) has its own lifecycle.",
    "why_skipped": "The founder's 'recordings to pull from' + this cron are the coaching-session recordings the manager reviews. If pitch-audio retention needs the same 20-window, that's a separate cron — flagged, not silently assumed in scope.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
