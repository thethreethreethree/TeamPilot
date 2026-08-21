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
- **Clean-Stop orphan chunks — CLOSED:** the recording-purge cron now removes the `${company}/${session}/chunks/`
  prefix for each session it purges (keyed on company_id + session id, not the fileId-based audio path), so a
  clean-Stopped session's chunks are cleaned within the 2-day retention window. maxDuration 60→300 for the added
  per-session list+remove. (A never-Stop stitch-FAILED session with no audio is out of the purge scope → its
  chunks persist; rare, and the stitch is idempotent-retried by the auto-close cron while still active.)
- **Cap orphan:** if a single auto-close run closes >25 sessions WITH chunks, the overflow is `ended` but
  unstitched. Steady-state closures/run << 25 (only sessions crossing 6h that hour), so it rarely binds.
- **Dead-recorder-on-reconnect seam — HANDLED for the never-Stop path (f5c66be8):** if the recorder is recreated
  mid-session (a mobile screen-lock ends the mic track → P0 rebuilds it), the new recorder emits a fresh webm
  EBML header. The STITCH now detects that header (`startsWithEbmlHeader`) and stops at the seam, keeping the
  first (valid) segment — the pre-lock audio, still playable + transcribable — instead of a corrupt concat. The
  post-lock segment is dropped (a full multi-segment recovery would need per-generation muxing; not worth it).
- **Clean-Stop-after-track-loss full blob — ALSO HANDLED (ccb0b1e1):** the clean-Stop path uploads
  `new Blob([all chunks])` via `persistRecording`, which would be corrupt at the seam if the recorder was
  recreated mid-call. Now `onstop` mirrors the server seam guard: a `recorderRecreatedRef` flag (set only when a
  recorder is rebuilt on a reconnect) gates an async scan that keeps only the first valid webm segment, with a
  try/catch fallback to the full blob. Flag-gated → the common single-recorder Stop is byte-identical to before.
  So BOTH audio paths (never-Stop stitch + clean-Stop blob) are seam-safe. (The onstop scan itself is React
  glue → device-confirmation; the seam logic mirrors the unit-tested `startsWithEbmlHeader`.)
- **Founder validation:** confirm a real never-Stopped call leaves a playable `recording.webm`.
