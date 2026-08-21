# CHECK — Incremental audio upload

## Built
- `src/lib/coach/v5/stitchSessionAudio.ts` — `orderedChunkSeqs` (pure) + `stitchSessionAudio` (idempotent
  concat → `audio_asset_url`, service-role, gap-truncates, cleans chunks on success).
- `src/app/api/coach/sales-session/[id]/audio-chunk/route.ts` — owner-gated chunk upload (POST ?seq=N), body
  cap 4 MB, idempotent on (session, seq), CWE-209-safe.
- `src/lib/coach/v5/useLiveCoaching.ts` — `rec.start(AUDIO_CHUNK_MS)` (15s timeslice); `ondataavailable`
  uploads each chunk fire-and-forget via `postAudioChunk`; `audioChunkSeqRef` (resets fresh, persists across
  reconnect); dep-array updated for `sessionId`.
- `src/app/api/coach/sales-session/auto-close-stale-cron/route.ts` — stitches up to `STITCH_PER_RUN=25` of the
  never-Stopped sessions it closes; `maxDuration` 60→300; returns `stitched` count.

## Tests (all green)
- `stitchSessionAudio.test.ts` (7): ordered-run / gap-truncation / dups+junk / empty; idempotent skip when
  audio already set; no-op when no chunks; happy-path stitch+stamp at `co/s1/recording.webm`.
- `audio-chunk/route.test.ts` (5): 401 / 404 / 403-non-owner / 400 bad-seq+empty / happy-path path pinning.

## Gate
`npm run check` GREEN — 3486 passing, 0 lint problems, all invariants intact (incl. coaching_sessions
tenant-scope + owner-required service-role write + CWE-209). Typecheck clean.

## Residual / notes
- **Clean-Stop orphan chunks:** a rep who DOES cleanly Stop gets `audio_asset_url` from the unchanged
  `persistRecording` (full blob); the stitch then skips (idempotent), leaving that session's chunks orphaned.
  Small; a prefix-age cleanup is a follow-up (noted, not blocking).
- **Cap orphan:** if a single auto-close run closes >25 sessions WITH chunks, the overflow is `ended` but
  unstitched. Steady-state closures/run << 25 (only sessions crossing 6h that hour), so it rarely binds.
- **Dead-recorder-on-reconnect seam:** if the recorder is recreated mid-session (rare — P0 keeps it alive), a
  new webm header lands mid-sequence and the stitched audio is corrupt at that seam (playable to the seam).
- **Founder validation:** confirm a real never-Stopped call leaves a playable `recording.webm`.
