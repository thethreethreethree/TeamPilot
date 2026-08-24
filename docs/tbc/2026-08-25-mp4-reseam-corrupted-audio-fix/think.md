---
started_at: 2026-08-25T05:10:30+08:00
---

# THINK — ElevenLabs STT "invalid_audio / corrupted": mp4-aware reseam + ground-truth capture

## The founder's report
Screenshot: "Processing failed after 5 attempts: ElevenLabs STT failed: 400 {"type":"validation_error",
"code":"invalid_audio","message":"File is corrupted. Please ensure it is playable audio.","status":
"invalid_content",…}". A Door Log pitch that terminally fails STT.

## Diagnosis, from the record (§0 — understanding earned before solving)

Traced the pitch pipeline: `worker.ts` stitches the recording's chunks (`stitchPitchAudio`) → downloads it →
`transcribeSpeech(audio, mimeType)` → ElevenLabs Scribe. The audio is NON-empty (worker guards 0-byte at
worker.ts:131) but ElevenLabs calls it unplayable — so the BYTES are malformed, not missing.

Ruled OUT (verified against code, A26 adversarial):
- **Missing first chunk** → `orderedChunkSeqs` starts the contiguous run at seq 0 and breaks on the first gap
  (stitchSessionAudio.ts:35) → a missing seq 0 returns `[]` → worker marks "No audio captured" (honest), NOT
  "corrupted". Refuted.
- **Mislabeled mimeType** → the chunk-upload route stores the client's real `content-type`
  (audio-chunk/route.ts:48); the stitch preserves the first chunk's type (pitchAudioChunks.ts:89). iOS mp4 flows
  through labeled mp4. Refuted as the primary cause.

Root (code-grounded, strong): **the recorder-recreation reseam guard is webm-only.** iOS Safari records
**audio/mp4** (useDoorRecorder.ts:37 — webm→mp4 fallback), and the recorder is recreated mid-call on reconnect
(the capture-crisis "survives-reconnect" fix). The reseam guard — `if (i>0 && startsWithEbmlHeader(bytes)) break`
— detects a NEW **webm** header (EBML `1A45DFA3`) and stops, keeping segment 1. But `startsWithEbmlHeader` never
matches an **mp4** init segment (`ftyp`), so on iOS an mp4 recording spanning a recreation concatenates TWO mp4
init segments into one file → unplayable → ElevenLabs "corrupted". Same webm-only guard in BOTH stitch paths
(pitchAudioChunks.ts:90 AND stitchSessionAudio.ts:96) → an A26 class, both fixed.

## Honesty about certainty (feedback_recurring_failure_instrument_dont_assume — the driving lesson)
The mp4-reseam gap is a REAL, applicable defect — but I cannot confirm from headless code that THIS specific
pitch was iOS+recreation (vs a truncated chunk, an unsupported codec). The pipeline captures ElevenLabs' verdict
("corrupted") but NOT the audio's own signature — that missing capture IS the defect this lesson names. So the
build does BOTH: (1) capture ground truth so the cause becomes DATA; (2) fix the identified gap.

## The fix (§1.5.1 layer 2 — make the pipeline actually work end-to-end)
1. **mp4-aware reseam** (`stitchSessionAudio.ts`): add `startsWithMp4InitSegment` (an `ftyp` box at offset 4) +
   `startsWithNewRecordingHeader` = EBML OR mp4-ftyp. Use it in BOTH reseam guards (pitch + live/meeting) so an
   mp4 recorder-recreation reseams (keep segment 1) exactly like webm.
2. **Ground-truth capture** (`worker.ts` around `transcribeSpeech`): on an STT failure, log + attach to the
   terminal error the audio's signature — `describeAudioBytes(buf, contentType)` = size, contentType, first-bytes
   magic, and the offset of a SECOND init segment (EBML/ftyp) mid-file (the bad-concat fingerprint). So the next
   occurrence names the real cause (a mid-file 2nd init = bad concat → this fix; else → the data points elsewhere).

## Ripple (holistic — §6 item 5)
- Pure helpers + a reseam-condition widening; no schema/route/API-contract change; no new external config.
- The reseam only ADDS a stop condition (mp4 init) — a webm recording is unaffected (mp4 check can't match EBML).
- The diagnostic runs only on the failure path (no cost/noise on success). The stitch stays idempotent.

## A30 gate
Tests: `startsWithMp4InitSegment` (matches ftyp@4, rejects EBML/short/garbage); `startsWithNewRecordingHeader`
(webm OR mp4); both stitch reseams stop at an mp4 init segment (drop the second recorder); `describeAudioBytes`
reports a mid-file second init segment.

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 05:10:30)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-25T05:12:30+08:00",
    "why_it_governs": "Understanding earned before solving.",
    "how_this_build_will_embody_it": "Traced the pipeline + ruled out missing-chunk/mislabel against code before naming the reseam gap; and stayed honest about what's unconfirmed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-25T05:12:35+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Verified ThinkerThinker.md in-tree; re-read each cited section fresh today." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "89-102", "read_at": "2026-08-25T05:12:00+08:00",
    "why_it_governs": "Layer 2 (operational effectivity) — a pitch that terminally fails STT does not deliver the intended result.",
    "how_this_build_will_embody_it": "The mp4-reseam fix makes the stitched audio actually playable end-to-end (STT succeeds)." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-148", "read_at": "2026-08-25T05:12:10+08:00",
    "why_it_governs": "THINK+search — the reported bug is one instance; search the class.",
    "how_this_build_will_embody_it": "Searched `startsWithEbmlHeader` usages → found the same gap in both stitch paths; fixed both." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-437", "read_at": "2026-08-25T05:12:40+08:00",
    "why_it_governs": "Quick-decision checklist (understand-why, class-sweep).",
    "how_this_build_will_embody_it": "Ran the checklist: understood the root, swept the reseam class, traced ripple." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-25T05:12:50+08:00",
    "why_it_governs": "Methodology in the working tree — no cached labels.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-25T05:12:55+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every cited § with a THIS-build read_at; the Session-Reads trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-702", "read_at": "2026-08-25T05:11:20+08:00",
    "why_it_governs": "A bug is one instance of a class; sweep to the boundary.",
    "how_this_build_will_embody_it": "Named the class (webm-only recorder-recreation reseam); swept BOTH stitch paths (pitch + live/meeting)." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-25T05:13:00+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Tests pin the mp4 detector + both reseams stopping at an mp4 init segment + the diagnostic." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-25T05:13:05+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
