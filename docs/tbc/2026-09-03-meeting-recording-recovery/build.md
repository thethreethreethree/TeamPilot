# BUILD — long-meeting recording recovery + durable fix

### Raise the storage size cap (0241)
- write-path: `supabase/migrations/0241_raise_assets_bucket_limit_for_long_recordings.sql` — `assets-v1`
  file_size_limit 25 MB → 250 MB. Applied via `npm run db:apply` (30/30 invariants hold).
- read-path: the server-side stitch of a long meeting (37–41 MB) is now accepted by storage instead of rejected.

### Parallelize the stitch download (stitchSessionAudio)
- write-path: `src/lib/coach/v5/stitchSessionAudio.ts` — chunk downloads now run with bounded concurrency (24),
  filling an ordered array; the subsequent ordered pass (stop-at-first-unreadable, stop-at-second-header,
  content-type-from-chunk-0) is byte-for-byte unchanged. Only the fetch is parallel.
- read-path: 163 chunks download in ~3s instead of ~145s, so the in-request self-heal (meeting-dissect) + the
  stale-close cron finish the stitch well within the 300s budget.

### Recover the sessions already lost (out-of-band scripts)
- write-path: `scripts/backfill-orphaned-recordings.mjs` — finds every session with `audio_asset_url IS NULL` +
  chunks in storage, stitches them (parallel), and stamps `audio_asset_url`. Recovered 3 meetings.
- read-path: opening any of the 3 recovered meetings' review now finds the stitched recording and transcribes it
  (the founder's proven at 34s / 37k chars — pasted in check.md) instead of "recording isn't ready".
- `scripts/diag-fm-*.mjs`, `scripts/recover-fm-meeting.mjs`, `scripts/verify-fm-transcribe.mjs` — the forensic +
  recovery + transcription-proof trail (READ-ONLY except the one-session recovery).

## Files
- `supabase/migrations/0241_raise_assets_bucket_limit_for_long_recordings.sql` (NEW)
- `src/lib/coach/v5/stitchSessionAudio.ts` (parallel download)
- `scripts/backfill-orphaned-recordings.mjs`, `scripts/diag-fm-meeting.mjs`, `scripts/diag-fm-chunks.mjs`,
  `scripts/diag-fm-stitch.mjs`, `scripts/diag-bucket-limit.mjs`, `scripts/recover-fm-meeting.mjs`,
  `scripts/verify-fm-transcribe.mjs` (NEW forensic/recovery tools)

## Ripple (§6 item 5)
- Both stitch trigger points (meeting-dissect self-heal + auto-close-stale-cron) benefit — same function.
- The 250 MB cap governs only what storage accepts; app-code per-upload caps unchanged, so no client can push a
  bigger direct upload. Bucket stays private + company-scoped (invariants re-verified).
- `orderedChunkSeqs` / header-detection pure functions untouched → their 19 unit tests still pin the semantics.

## Residual (A36)
- The recovery is currently a manual/out-of-band backfill + a lazy self-heal on first review. A PROACTIVE
  "stitch orphaned recordings" cron (like the dissect backfill) would recover future orphans without a user
  retry. Deferred — the deployed fix means new long sessions self-heal on review in-budget.
