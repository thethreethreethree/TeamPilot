# Runbook — Sales Coach recording / voice-memo upload

The flow a rep uses to turn a **saved call recording or phone voice memo** (iPhone Voice Memos `.m4a`,
Android `.m4a`/`.amr`/`.3gp`/`.ogg`/`.wav`, plus `.mp3`/`.wav`/`.mp4`/`.webm`) into a coached, reviewed
session. Built + hardened 2026-08-11 (commits `0a873a3` → `e1f9716b`). This runbook is the ops reference for
"a rep's upload isn't working" and for understanding how the pieces fit.

---

## The architecture (why it's built this way)

**The load-bearing fact:** Vercel serverless functions hard-cap the request body at **~4.5 MB**. A route that
receives the file through `req.formData()` therefore rejects any real recording (a 10-min Voice Memo is ~5 MB;
a 30-min call ~25 MB) at the PLATFORM layer, before any app code runs. So the upload goes **direct from the
browser to Supabase Storage**, bypassing the function body entirely:

1. **Sign** — `POST /api/coach/sales-session/[id]/upload-recording/sign` → validates access
   (auth + company + **owner-or-manager**, INV19) + size (≤ 25 MB) + `audio/`|`video/` MIME + non-executable
   ext, then mints a signed upload target (`{ bucket, storagePath, token }`).
2. **Upload** — the browser `supabase.storage.from(bucket).uploadToSignedUrl(storagePath, token, file)` writes
   the bytes straight to Storage (up to the 25 MB bucket cap).
3. **Finalize** — `POST /api/coach/sales-session/[id]/upload-recording` with JSON `{ storagePath }` →
   re-reads the REAL object (`getAssetObjectInfo`; client-claimed size untrusted), stamps `audio_asset_url`
   FIRST (recovery contract), transcribes from storage (ElevenLabs Scribe, diarized), and — new 2026-08-11 —
   stamps `audio_duration_seconds` (the real length, from the Scribe word timestamps).
4. **Label** — the rep one-taps "which voice is you?" → `POST …/label-transcript` appends the labeled
   transcript. This is **append-only** and **guarded**: it returns **409** if the session already has a
   transcript (no double-append onto the record the review runs on).
5. **Name + review** — the required naming gate fires → session ends → After-Pitch summary.

A **multipart** branch on `/upload-recording` remains as a guarded fallback (small files / legacy) but the
client no longer uses it.

**Surfaces:** the upload is available on the Standard live-session screen, the After-Pitch screen (both modes),
and Expert's session screen — but hidden once a transcript already exists (the 409 guard's UI complement).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| **Upload fails immediately / "couldn't start"** | The sign step was rejected. | 403 = the caller isn't the session's owner or a Sales-Coach manager (INV19). 413 = the file is over 25 MB (a very long recording) — split it or raise `AGENT_MAX_BYTES` + the bucket cap. 400 = non-audio/video file or a blocked extension. |
| **Upload seems frozen on mobile** | A large recording is still SENDING to storage (the slow phase for a 20-25 MB file). | Expected — the status now says "Uploading…" then "Transcribing…" with a "keep this screen open" note (`e1f9716b`). It is not hung; a long call takes a moment. No byte-% bar (the Supabase client can't report upload progress). |
| **"No speech was transcribed from that recording"** | Scribe returned no words — silent/corrupt audio, or a container Scribe can't decode (rare `.amr`/`.3gp`). | Confirm the file actually has audio. Re-record as `.m4a`/`.mp3`/`.wav` if it was an exotic format. This is honest (§3.4) — never a silent empty. |
| **Voice / transcription broken for EVERYONE at once** | The ElevenLabs key — same root as live coaching + Jeff. | See `elevenlabs-voice-outage.md`. Run `/api/coach/sales-session/voice-health`. |
| **Duration shows wrong (e.g. 62m for a 4m clip)** | The session pre-dates migration 0210, so `audio_duration_seconds` is null and the surface falls back to the session WALL-CLOCK (how long the session sat open). | New uploads (2026-08-11+) capture the real length. Historical rows keep the wall-clock — re-transcribe if the number matters. See `reference_duration_from_wallclock_wrong_for_uploads`. |
| **Rep can't upload a second recording to a session** | By design — `label-transcript` returns 409 once a transcript exists, and the UI hides the upload. | Correct behavior (one call = one recording). Start a new session for a different call. |

---

## Recovery contract (no data loss on an STT outage)

The audio is persisted (`audio_asset_url` stamped) BEFORE transcription runs, so if Scribe fails the audio
survives. A rep whose transcript didn't land sees **"Re-transcribe from saved recording"** →
`POST …/retranscribe` re-runs Scribe from storage (no re-upload), and now also stamps the duration.

## Code pointers
- Sign: `src/app/api/coach/sales-session/[id]/upload-recording/sign/route.ts`
- Finalize + multipart: `src/app/api/coach/sales-session/[id]/upload-recording/route.ts`
- Recovery: `src/app/api/coach/sales-session/[id]/retranscribe/route.ts`
- Append guard: `src/app/api/coach/sales-session/[id]/label-transcript/route.ts`
- Client: `src/components/sales-coach/SessionRecordingUpload.tsx`
- Transcription + duration: `src/lib/care/voice/elevenlabs.ts` (`transcribeWithDiarization`)
- Direct-to-storage helpers: `src/lib/storage/assets.ts` (`createSignedUploadTarget`, `getAssetObjectInfo`)
- Duration column: migration `0210_coaching_session_audio_duration.sql`
- TBC builds: `docs/tbc/2026-08-11-xd-mobile-recording-upload`, `…-xe-upload-audio-duration`
