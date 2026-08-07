# BUILD — Re-transcribe recovery

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match the top-level `docs/tbc/DOC_MANIFEST.json` (hash + line count); no governing-doc change, no AMD required.

## Change

### Re-transcribe route — recover from stored audio
`src/app/api/coach/sales-session/[id]/retranscribe/route.ts` (new).

- **write-path:** `POST /retranscribe` — the rep/manager triggers it from the session page button.
  Authenticates → resolves company → `getSession` (RLS company scope) → owner-OR-manager gate (INV19) →
  parses `audioAssetUrl` via `assetUrlToStoragePath` → `downloadAssetBytes` → `transcribeWithDiarization`
  (`maxDuration=300`). It does NOT write the transcript; it returns `{segments,speakers}`.
- **read-path:** the caller (`SessionRecordingUpload`) renders the returned speakers as the one-tap step;
  the human tap posts to the existing `/label-transcript`, which appends. The appended transcript renders
  through the unchanged session-page transcript section. Errors are honest: 502 with `audioSaved:true` on a
  transcription failure, 409 no-recording, 422 unrecognized pointer, 403 not-owner-not-manager.

### Storage primitives — downloadAssetBytes + assetUrlToStoragePath
`src/lib/storage/assets.ts`.

- **write-path:** `downloadAssetBytes({storagePath})` fetches raw bytes via the admin storage client
  (mirrors `uploadAssetBytes`); `assetUrlToStoragePath(url)` returns the bucket-relative path or null for an
  unrecognized shape. Both are pure server-side capability functions with no caller-facing state.
- **read-path:** the route consumes `downloadAssetBytes(...).bytes` and hands them to diarization; it feeds
  `assetUrlToStoragePath` the stored pointer and 422s on null. `assetUrlToStoragePath` is unit-tested; the
  route test asserts the STRIPPED path (`co1/rec.webm`) reaches `downloadAssetBytes`.

### Recovery affordance — "Re-transcribe from saved recording"
`src/components/sales-coach/SessionRecordingUpload.tsx`, `src/app/dashboard/sales-coach/[id]/page.tsx`.

- **write-path:** the page passes `hasSavedRecording={!!session?.audioAssetUrl && transcript.length===0}`.
  When true, the component renders a secondary button whose `onClick` calls `retranscribe()` → the route
  above. `session.audioAssetUrl` is declared on the page's local `Session` type (runtime already returned it
  from `getSession`).
- **read-path:** `retranscribe()` shares `applyTranscribeResponse` with the upload path, so a success drops
  the rep into the identical speaker-tap → append → transcript-renders flow. The button is gated to the
  empty-transcript state, so it can never drive a duplicate append onto a populated transcript.

## Four-layer pre-walk (§1.5.1)
- **L1 build structure:** mirrors the sibling `/upload-recording`; two reused primitives; no new schema/
  column/write path — the transcript keeps its single appender. Sound.
- **L2 operational effect:** invoked as a real orphaned session would be, the route downloads → diarizes →
  returns; the route test drives 401/404/403/409/422/502/200 + manager. Works.
- **L3 synergetic completeness:** before = empty transcript + saved recording, a dead-end unless the rep
  still had the file; after = one click → the same tap → append → review unlocks. Continuity restored —
  this layer is the reason the feature exists.
- **L4 surface:** the affordance sits under the upload button, hairline-separated, one plain sentence, outline
  styling (recovery, not primary), vocabulary matched to the page. Aligned.

## Verdict: SHIPPABLE
All four layers pass; the feature restores the L3 continuity the re-upload path lacked, reuses the tested
append path, and gates the tenant + duplication risks (think.md section 4).

## Files
- `src/app/api/coach/sales-session/[id]/retranscribe/route.ts`
- `src/app/api/coach/sales-session/[id]/retranscribe/__tests__/route.test.ts`
- `src/lib/storage/assets.ts`
- `src/lib/storage/__tests__/assetUrlToStoragePath.test.ts`
- `src/components/sales-coach/SessionRecordingUpload.tsx`
- `src/app/dashboard/sales-coach/[id]/page.tsx`
