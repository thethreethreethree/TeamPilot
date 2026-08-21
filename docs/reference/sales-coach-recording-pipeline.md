# Sales Coach recording pipeline — reference map

> Written 2026-08-12 after the first-client "sessions constantly failing to record" incident (build xp). The
> recording → transcript → review flow is spread across ~8 files with several failure modes; this maps the
> whole thing in one place so the next maintainer (or the next incident) doesn't have to re-derive it.

## The two capture paths

A session's canonical transcript (`coaching_transcript_segments`, append-only, section 3.1) is produced one of two ways:

### 1. LIVE coaching (the primary in-person / real-time path)
- **`useLiveCoaching.ts`** opens the mic (`getUserMedia`), records the audio in parallel via `MediaRecorder`
  (→ `recordingBlob`), and streams the audio to **ElevenLabs realtime STT** over a websocket, authed by a
  single-use token minted server-side (`/realtime-token`). Committed turns accumulate in `turnsRef` AND are
  flushed to the DB every 4s (so a drop/never-Stop keeps the transcript). A mid-call drop **auto-reconnects**
  (fresh token) while keeping the recorder + mic + transcript alive (2026-08-21 P0).
- **Audio durability — INCREMENTAL upload (2026-08-21).** `MediaRecorder` runs with a 15s timeslice; each chunk
  is uploaded fire-and-forget (one idempotent retry) to `/audio-chunk?seq=N` → `${company}/${session}/chunks/`.
  On session end `stitchSessionAudio` byte-concatenates the chunks into `recording.webm` + stamps
  `audio_asset_url`. So the audio survives ANY ending (drop / tab-close / phone-lock / crash / **never-Stop**),
  not only a clean Stop. See `docs/tbc/2026-08-21-incremental-audio-upload/`.
- On **Stop**: if `turnsRef.length > 0`, it POSTs `/finalize` (keepalive) — the SERVER appends the transcript
  then generates the review artifacts (`generateSessionArtifacts`). `transcriptSaved` ← finalize ok. The
  clean-Stop full-blob persist (`persistRecording`, below) still runs; the stitch skips it (idempotent).
- **`LiveCoachingPanel.tsx`** renders it + owns the post-Stop UX (see "persist + advance" below).

### 2. UPLOADED recording (phone voice memo / mobile record; recovery)
- **`SessionRecordingUpload.tsx`**: sign (`/upload-recording/sign`) → `uploadToSignedUrl` direct to Storage
  (bypasses the ~4.5MB Vercel body cap) → `/upload-recording {storagePath}` transcribes from storage + returns
  diarized speakers → the rep taps "which voice is you?" → `/label-transcript` appends the labeled transcript
  → which then runs `generateSessionArtifacts` (via `after()`).
- **`/retranscribe`** is the same, re-transcribing audio already in Storage (no re-upload).

## Failure modes and where each is handled

| Failure | Symptom | Where handled |
|---|---|---|
| Live STT captures ZERO turns (dead feed / missing STT scope) | "No conversation was captured" | **Survivable via BOTH audio paths**: the incremental chunk upload (during the call) saves the audio even if the rep never Stops — stitched on auto-close; AND the clean-Stop `persistRecording` full-blob upload for a Stopped call. Either leaves re-transcribable audio. In-call amber warning after ~30s of no turns. (Historically this relied ONLY on the on-Stop persist, which missed the never-Stopped majority — the 2026-08-21 incremental upload closed that.) |
| Audio was saved but transcript empty | After-pitch empty state | `after-pitch/page.tsx`: if `session.audioAssetUrl` present → "transcription didn't connect, audio saved, recover it" + `SessionRecordingUpload autoRetranscribe` auto-recovers. Else → "nothing recorded". **The 2026-08-21 incremental upload EXTENDS this to never-Stopped sessions**: the stitch sets `audio_asset_url` for a session the rep never Stopped, so its empty-transcript after-pitch now shows the recover-from-audio path (previously it had no audio → the dead "nothing recorded" branch). So a never-Stopped call with dead live-STT recovers its transcript on view via this existing path. |
| ONE-SIDED transcript — customer side missing (agent captured, `custW===0` → talk/listen "—"), blank "Your read" despite scores | After-pitch shows scores but no written read | **Now auto-recovered (build 2026-08-14):** `after-pitch/page.tsx` detects it via `afterPitchNeedsAutoRecover` (`captureGap.ts`: the `talk_ratio` caveat) and POSTs `/auto-recover` (once per id) BEFORE the LLM heal. The server re-diarizes the saved audio, `autoAssignAgentCluster` (`autoSpeakerAssign.ts`) picks the agent cluster — or DECLINES to the manual one-tap card rather than guess — ATOMICALLY replaces the broken transcript (`replace_session_transcript` RPC, 0212: delete+insert in one transaction, so a failed re-save leaves the original intact — never a false "recovered"), and regenerates. At-most-once across reloads via the `auto_recover_attempted_at` marker (migration 0211), claimed atomically before any STT + released on a transient STT failure so a later retry isn't burned. |
| ElevenLabs key/scope/quota problem (the FREQUENCY driver) | Captures fail often | Diagnose via **`/voice-health`** (`probeElevenLabsVoice`: key present → `sk_` format → account/quota → **realtime STT token mint** = the STT-scope check). Surfaced in Settings → Coaching → "Voice provider health" card. ENV fix (enable STT scope) is the operator's. |
| Transcription throws mid-finalize | Partial artifacts | Each engine in `generateSessionArtifacts` is `.catch(fallback)` + `withEngineTimeout` — one failing never drops the others. Audio persisted BEFORE transcription in the upload path (recovery contract). |
| Short but successful call | "too short to read" | `after-pitch`: the "Your read" points to scores + Next Door Focus instead of dead-ending (a thin narrative co-exists with real score signal). |

## Post-Stop "persist + advance" (LiveCoachingPanel, build xp)
1. Recording stops → `recordingBlob` available → **persist it to Storage** (`savingState` pending→saving→saved/failed),
   keyed on blob identity (`persistedBlobRef`) so stop→restart persists each recording. 60s timeout.
2. Advance to naming/After-Pitch (`onRecordingSaved`) waits until the persist SETTLES — so the audio is safe
   before navigation ("block with Saving…", founder choice). No blob (recorder failed) → don't wait.
3. If the transcript failed: the recovery UI re-transcribes from the SAVED audio (`savingState === "saved"`),
   not a re-upload of the blob (avoids double-upload).

## Key invariant
**The audio is the load-bearing artifact.** Everything downstream (transcript, review, scores) can fail and be
regenerated — but only if the audio survived. The original incident was that the live path never persisted it;
the first fix (2026-08-12) persisted the full blob **on Stop** — but the 2026-08-21 audit found reps
overwhelmingly do NOT cleanly Stop (they close the tab), so on-Stop persist never ran for them. The rule now:
**persist the audio INCREMENTALLY during the call** (15s chunks → stitched on session end), so it survives any
ending — not only a clean Stop. The on-Stop full-blob persist remains as the clean-Stop path; the two are
idempotent (whichever sets `audio_asset_url` first wins; the stitch skips an already-set pointer).

## Tests
- `upload-recording/__tests__/route.test.ts` — the multipart + JSON(persistOnly) branches + the recovery contract.
- `persistRecording.test.ts` — the client sign→upload→finalize orchestration + throw-on-failure.
- `label-transcript/__tests__/route.test.ts` — append + the `generateSessionArtifacts` trigger + the
  delete-guard (a failed clear → 500, never a partial re-save).
- `generateSessionArtifacts.test.ts` — the five-engine resilience (one fails ≠ all drop).
- `stitchSessionAudio.test.ts` — the incremental-audio stitch: contiguous-run/gap-truncation ordering,
  idempotent skip-when-audio-set, and the chunk storage-path contract (route/stitch/purge single source).
- `audio-chunk/__tests__/route.test.ts` — the chunk-upload owner-gate (401/404/403/400) + company/session/seq
  path pinning.
- `auto-close-stale-cron/__tests__/route.test.ts` — closes stale sessions AND stitches each with the correct
  per-session company pinning (`stitched` count).
- `reconnectPolicy.test.ts` + `reconnectTeardownInvariant.test.ts` — the reconnect budget + the source guard
  that a reconnect never tears down the recorder (the regression that discarded audio on every drop).
- `auto-recover/__tests__/route.test.ts` — owner-only, canonical-never-clobbered, at-most-once marker (no STT
  on a repeat), decline-vs-guess, delete-guard.
- `autoSpeakerAssign.test.ts` / `captureGap.test.ts` / `blankReadRecovery.test.ts` — the pure recovery logic:
  agent-cluster decision (declines when unsure), capture-gap direction detection, fallback-card visibility.
- React glue (LiveCoachingPanel effects) is not unit-testable in the node env — device confirmation required.
