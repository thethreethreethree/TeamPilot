---
started_at: 2026-08-27T06:23:00+08:00
---

# THINK — iOS DoorLog "no audio recorded": the webm-mimetype regression (P0)

## The report + INSTRUMENT-first diagnosis (§1.2, never assume)
Founder (urgent, 2nd time): the "no audio was recorded" banner "still happens" — a screenshot of a real iPhone DoorLog
session. I did NOT re-apply my earlier requestData fix on faith (a recurring failure means the prior diagnosis was
incomplete). I pulled the REAL telemetry (`scripts/diag-capture-live.mjs` → `doorlog.capture_failed` events):

- **100% iOS 18.7 / Safari 26.6**, `mimeType = "audio/webm;codecs=opus"`, `sawData=true`, `chunkCount=1`,
  `chunksUploaded=0`, over multi-minute durations, with `recorderError=null`, `trackEnded=false`, `trackMuted=false`,
  `hiddenDuringRecording=0`, `wakeLockGranted=true`. Every alternative cause is RULED OUT by the data.
- The banner fires only when `isCaptureViable` is false, i.e. the final blob is `< 1024 bytes` — so iOS is producing a
  sub-1KB STUB despite a long recording. sawData=true (a data event fired) but the data is a container stub, no audio.

Root cause: **iOS Safari 18.x now FALSELY reports `isTypeSupported("audio/webm;codecs=opus") = true`, but MediaRecorder
then produces an empty stub for webm.** My 2026-08-23 `pickSupportedMimeType` change preferred webm for EVERY browser —
which is exactly what made iOS pick webm instead of its working mp4 default. A regression I introduced. (Confirmed the
earlier requestData fix WORKS — sawData=true now — but the wrong container defeats it.)

## The telemetry was BLIND on the key field (the swallowed reason — §1.2/A22 lesson)
The `capturedBytes` field (the real "was there audio" signal) was in the CaptureDiag type + client payload, but the
door-log capture-diag route's zod schema OMITTED it → zod stripped it → the byte volume never reached the record. Fixed
(added to the schema), so the next round is fully data-driven.

## The fix (§1.5.1 layer 2 — must actually work end-to-end)
1. **iOS → mp4**: `pickSupportedMimeType` prefers mp4/aac on iOS (which iOS actually encodes), webm-first elsewhere.
2. **Downstream precondition CHECKED, not assumed**: the fallback whole-blob upload hardcoded `originalFilename:
   "pitch.webm"` — an mp4 blob named .webm can misparse in transcription. Now the client sends the blob's mimeType and
   the server derives the extension (`extForMime`). (The chunked path is webm-only, but iOS ignores timeslice so it uses
   the fallback whole-blob path anyway — the exact path this fixes.)
3. **Sweep (A26)**: checked the other MediaRecorder recorder — C.A.R.E `useVoiceMode` uses `new MediaRecorder(stream)`
   with NO explicit type (browser-default → iOS mp4, works). live/meeting use the Scribe realtime socket, not blobs. So
   only DoorLog forced webm; the fix is correctly DoorLog-only.

## A30 gate
`pickMime.ios.test.ts`: on an iOS UA, the picker returns mp4 EVEN when webm is (falsely) reported supported; non-iOS
keeps webm-first. A re-introduction of the webm-on-iOS regression fails the test.

## Ripple (§6 item 5)
Recorder mime + a sign-request field + the sign filename + the diag schema. No schema/table change. The non-iOS path is
unchanged (still webm). The captured-bytes instrumentation is additive.

## Session-read manifest (A22 — read_at ≥ started_at 06:23:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T06:24:02+08:00",
    "why_it_governs": "Understand WHY audio is empty before fixing — a recurring failure means the last diagnosis was incomplete.",
    "how_this_build_will_embody_it": "Pulled real telemetry; found the webm-stub regression, not a re-guess." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T06:24:20+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-08-27T06:24:04+08:00",
    "why_it_governs": "Retrospective identification — look at the actual record, not theory.",
    "how_this_build_will_embody_it": "The capture_failed telemetry (100% iOS webm, ruled-out alternatives) named the root from data." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "88-92", "read_at": "2026-08-27T06:24:06+08:00",
    "why_it_governs": "Layer 2 — the fix must make audio actually persist AND transcribe end-to-end.",
    "how_this_build_will_embody_it": "iOS mp4 capture + the filename fix so the mp4 blob parses downstream; the swallowed byte field re-instrumented." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "144-146", "read_at": "2026-08-27T06:24:12+08:00",
    "why_it_governs": "Proactively THINK the class + adjacent recorders, not just the one symptom.",
    "how_this_build_will_embody_it": "Swept C.A.R.E + live/meeting (unaffected) and fixed the telemetry blindness that hid this." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T06:24:08+08:00",
    "why_it_governs": "Honesty — the diagnostic must not swallow the reason.",
    "how_this_build_will_embody_it": "Restored capturedBytes to the telemetry so 'was there audio' is on the record, not assumed." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T06:24:22+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: instrumented first, fixed the real cause + the downstream precondition, swept the class, gated the lesson." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-456", "read_at": "2026-08-27T06:24:24+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-08-27T06:24:26+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-771", "read_at": "2026-08-27T06:24:28+08:00",
    "why_it_governs": "Gate the lesson — a prose 'don't use webm on iOS' returns.",
    "how_this_build_will_embody_it": "pickMime.ios.test.ts fails if the webm-on-iOS regression is reintroduced." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1002", "read_at": "2026-08-27T06:24:30+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code; the diagnosis is from live telemetry." }
]
```
