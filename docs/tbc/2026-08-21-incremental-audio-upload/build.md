# BUILD — Incremental audio upload

Order built, each typechecked/tested before the next:

1. **`stitchSessionAudio.ts`** — pure `orderedChunkSeqs` (contiguous-from-0, gap-truncate, dedup) + the
   idempotent `stitchSessionAudio` (guard on `audio_asset_url` → list chunks → download in order → `Buffer.concat`
   → upload `recording.webm` upsert → stamp `${ASSETS_BUCKET}/${path}` with `.is(null)` race guard → best-effort
   chunk cleanup). Unit-tested first (pure + idempotency).

2. **`audio-chunk/route.ts`** — `POST ?seq=N`, owner-gate mirroring `/segments` (getSession → agentId check),
   4 MB body cap, `uploadAssetBytes` to `${companyId}/${id}/chunks/${seq}.webm`, dedup-as-success, CWE-209.

3. **`useLiveCoaching.ts` recorder wiring** — module `postAudioChunk` (fire-and-forget, NOT keepalive: a
   ~200 KB chunk exceeds the 64 KB cap); `AUDIO_CHUNK_MS=15_000`; `audioChunkSeqRef` (reset fresh / persist
   across reconnect); `rec.start(AUDIO_CHUNK_MS)`; `ondataavailable` pushes to `chunksRef` AND uploads;
   `sessionId` added to `start`'s deps.

4. **`auto-close-stale-cron`** — select `company_id`; after the close UPDATE, stitch up to `STITCH_PER_RUN=25`
   closed sessions (idempotent, cheap no-op for chunk-less pre-feature sessions); `maxDuration` 60→300;
   `stitched` in the response.

Design decisions + trade-offs: see think.md; residuals: see check.md.
