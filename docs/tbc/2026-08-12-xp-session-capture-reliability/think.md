---
tbc_version: 1
trigger: fix
started_at: 2026-08-12T08:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 2
---

# THINK — sessions "constantly failing to record" (first-client incident) — never lose the audio

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (founder priority, first client — cannot be deferred)
The founder's first client/tester reports sessions "constantly failing to record and process." Screenshot: a
9m10s call showing "No conversation was captured for this call yet." The founder requires (1) an immediate fix,
(2) a preventative measure, (3) an indication of WHY it failed.

## 3. Diagnosis (§2 — traced through the code, not guessed)
Live capture uses ElevenLabs realtime STT (LiveCoachingPanel → useLiveCoaching, rendered in BOTH modes). It
sometimes captures ZERO turns (consistent with the known scoped-key/token issue already in the queue). When it
does:
- `finalize` is never called (guarded on `captured.length > 0`), so no transcript lands.
- The recorded audio (MediaRecorder blob) lived ONLY in browser memory — a grep for any storage/upload in
  useLiveCoaching was EMPTY. It was never persisted.
- The only recovery UI (LiveCoachingPanel) lives on the session page, which Standard AUTO-REDIRECTS away from
  to After-Pitch the instant the session ends → the blob is lost → the audio is gone.
Result: a failed live capture is UNRECOVERABLE — "No conversation was captured," and "Re-transcribe from saved
recording" has no saved audio to use. That is the incident.

## 4. The fix (this build ships parts 1 + 3; parts 2 + 4 follow immediately)
Founder chose (AskUserQuestion 2026-08-12): "Block with 'Saving recording…'" + "All four now". Staged so the
critical, tested foundation ships first (a giant untested change to the core recording pipeline for the #1
client is the higher risk):
1. **IMMEDIATE (this build):** persist the recorded audio to Storage the instant recording STOPS, BEFORE any
   navigation — so a failed capture is never lost and is always re-transcribable. New `persistOnly` path on
   /upload-recording (stamp audio_asset_url, skip STT) + a shared `persistRecording` client helper mirroring
   the proven direct-to-storage flow + LiveCoachingPanel: auto-persist on Stop with a blocking "Saving
   recording…" state that gates the advance to After-Pitch (the founder's "block" choice), timeout-bounded so a
   stalled upload can't trap the rep.
3. **INDICATION (this build):** After-Pitch distinguishes "transcription didn't connect, but your audio was
   saved — recover it" (audio_asset_url present) from "nothing was recorded at all" — an honest WHY, not one
   vague empty state (§3.4).
2. **PREVENTATIVE (next):** when the transcript is empty but audio is saved, auto-trigger re-transcribe
   (self-heal) + detect a dead live feed during the call.
4. **SHORT-CALL (next):** give feedback whenever audio exists, instead of the "too short to read" dead-end.

## 5. Record check (§1.2)
The recovery contract (audio persisted BEFORE transcription) already existed for the UPLOAD path (tested — it
saved 4 orphans in the 2026-08 outage). This build extends the SAME contract to the LIVE path (which had no
persistence at all). Not a new invention — closing a gap in an established, tested pattern (A16/A26).

## 6. Hypotheses (§1.5.2)
- **H1 — does the blocking persist risk trapping the rep?** Mitigated: the persist is timeout-bounded (60s) and
  best-effort (on failure the rep still advances; the manual upload + re-transcribe remain). The advance fires
  once persist SETTLES (saved OR failed). CONFIRMED by the effect logic + typecheck.
- **H2 — could the auto-persist double-upload against the existing recovery UI?** The LiveCoachingPanel recovery
  fallback now branches on savingState: 'saved' → re-transcribe from the saved audio (no re-upload); 'failed' →
  re-upload the client blob. So no double-upload. CONFIRMED by the render change.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T08:30:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand the failure from the record before fixing.", "how_this_build_will_embody_it": "Section 3 traces the exact capture→persist gap." },
  { "id": "§0.1", "read_at": "2026-08-12T08:30:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-12T08:31:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective — the upload path's recovery contract is the established pattern to extend.", "how_this_build_will_embody_it": "Section 5 checks the record; the live path now shares the upload path's persist-first contract." },
  { "id": "§2", "read_at": "2026-08-12T08:31:10Z", "source_file": "CLAUDE.md", "line_range": "208-230", "why_it_governs": "Diagnose before patching — state the root cause from the code before changing it.", "how_this_build_will_embody_it": "Section 3 traces the capture→persist gap end-to-end before any fix." },
  { "id": "A19", "read_at": "2026-08-12T08:30:50Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree this session.", "how_this_build_will_embody_it": "Read useLiveCoaching + LiveCoachingPanel + the upload routes in-tree before changing them." },
  { "id": "§1.5.1", "read_at": "2026-08-12T08:31:20Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer 3 — a session that records but can't produce a review is a broken workflow.", "how_this_build_will_embody_it": "The fix makes the audio survive to After-Pitch so recovery is always reachable; honest indication of the state." },
  { "id": "§1.5.2", "read_at": "2026-08-12T08:31:35Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive — think through the trap/double-upload risks before wiring.", "how_this_build_will_embody_it": "H1/H2 address timeout-trap + double-upload; both mitigated." },
  { "id": "§3.4", "read_at": "2026-08-12T08:31:50Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — a failure must not read as 'nothing happened'; say WHY + that the audio is safe.", "how_this_build_will_embody_it": "Indication distinguishes transcription-failed-audio-saved from nothing-recorded." },
  { "id": "§6", "read_at": "2026-08-12T08:32:05Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — record-check + holistic before acting.", "how_this_build_will_embody_it": "Sections 3-5; the change is traced across route + helper + panel + after-pitch." },
  { "id": "A16", "read_at": "2026-08-12T08:30:45Z", "source_file": "ThinkerThinker.md", "line_range": "381-390", "why_it_governs": "Define shared behavior once — reuse the proven upload flow, don't fork it.", "how_this_build_will_embody_it": "persistRecording mirrors SessionRecordingUpload's sign→upload→finalize; persistOnly extends the same route." },
  { "id": "A22", "read_at": "2026-08-12T08:32:20Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads; minimum set present." },
  { "id": "A30", "read_at": "2026-08-12T08:32:35Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the lesson in a test.", "how_this_build_will_embody_it": "Added a persistOnly route test (stamps pointer + skips STT); the recovery contract tests still lock persist-before-transcribe." },
  { "id": "A38", "read_at": "2026-08-12T08:32:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check.md pastes the vitest + npm run check with exit codes." }
]
```
