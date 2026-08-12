# BUILD — session capture reliability (never lose the audio) — parts 1 + 3

## Feature inventory

### Live-recorded audio is persisted to Storage on Stop, before navigation (`persistRecording` + `upload-recording` persistOnly + `LiveCoachingPanel`)
- write-path: on recording Stop, `LiveCoachingPanel` fires `persistRecording(sessionId, blob)` →
  `POST /upload-recording/sign` → `uploadToSignedUrl` (direct to Storage, bypasses the ~4.5MB body cap) →
  `POST /upload-recording { storagePath, persistOnly: true }`, whose new branch stamps
  `coaching_sessions.audio_asset_url` (company-scoped service-role write) and returns
  `{ ok, audioSaved, persisted }` WITHOUT transcribing. A blocking "Saving recording…" state gates the advance
  to After-Pitch until the save settles (founder's "block" choice); 60s timeout so a stall can't trap the rep.
- read-path: After-Pitch reads `session.audioAssetUrl` — if present, a failed capture shows "Live transcription
  didn't connect… your audio was saved. Recover it below" and the recovery offers re-transcribe from the saved
  audio; if absent, the existing "nothing was recorded" guidance. So a failed live capture is now always
  recoverable. Reachable on every live Standard/Expert session; the persistOnly route branch is locked by
  `upload-recording/__tests__/route.test.ts`.

## Files changed
- **src/app/api/coach/sales-session/[id]/upload-recording/route.ts** — json branch: `persistOnly` flag → after
  stamping `audio_asset_url`, return `{ ok, audioSaved, persisted }` and SKIP transcription.
- **src/lib/coach/v5/persistRecording.ts** (NEW) — client helper: sign → uploadToSignedUrl → finalize
  (persistOnly). Mirrors SessionRecordingUpload's proven flow (A16); throws on failure.
- **src/components/sales-coach/LiveCoachingPanel.tsx** — auto-persist the blob on Stop (`savingState`
  pending/saving/saved/failed, timeout-bounded); the advance to naming/After-Pitch (`onRecordingSaved`) now
  waits for the persist to SETTLE; a "Saving recording…" indicator; the recovery fallback branches on
  savingState (saved → re-transcribe from saved audio, no re-upload; failed → re-upload the client blob).
- **src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx** — the empty-capture state distinguishes
  "transcription didn't connect, audio saved, recover" (audioAssetUrl present) from "nothing recorded".
- **src/app/api/coach/sales-session/[id]/upload-recording/__tests__/route.test.ts** — new persistOnly test.

## What did NOT change / holistic (§1.5.1)
- The live CAPTURE + finalize path is UNTOUCHED — the persist is additive (a new side-effect on Stop), so it
  can't break the happy path where live STT works.
- The upload path's recovery contract (persist-before-transcribe) is unchanged and still tested.
- Parts 2 (auto-recover) + 4 (short-call feedback) are NOT in this build — they follow immediately (see closure).
