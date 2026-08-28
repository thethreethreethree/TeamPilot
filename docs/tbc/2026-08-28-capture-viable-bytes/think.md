---
started_at: 2026-08-28T13:45:00+08:00
---

# THINK — gate capture viability on BYTE VOLUME, not chunk count (24% pitch-failure bug)

## Why (a critical, current production bug — found by proactive audit §1.5.2)
Auditing door-pitch health surfaced ~24% of pitches FAILING this week (11/45), all with the same STT 400:
`invalid_audio ... "File is corrupted" [audio size=5 ct=audio/webm]` — a 5-BYTE stub. Root cause (airtight from
the code + the error, §1.2): `isCaptureViable` returned `true` whenever `chunksUploaded > 0`, ignoring byte volume.
But iOS streams a 5-byte container stub as "1 chunk", so a stub passed the gate → became a pitch → died at STT as
a misleading "corrupted". The IRONY: the `CaptureDiag` type already documents `capturedBytes` as "the real 'was
there audio' signal (iOS 5-byte stubs)" — but `isCaptureViable` didn't use it. The founder approved the fix.

## The build (§1.5 — use the signal the codebase already tracks)
- `captureDiag.ts isCaptureViable` — add `capturedBytes?`; when known it is AUTHORITATIVE (viable iff
  `capturedBytes >= MIN_VIABLE_AUDIO_BYTES` = 1KB). Falls back to the old chunk/blob signals only when unknown
  (backward-compatible; DoorLog is the ONLY caller — verified — so blast radius is the door flow).
- `DoorLog.tsx` — passes `capturedBytes: recorded.diag.capturedBytes` (already tracked in useDoorRecorder).

## Why it's safe (§1.5.1 layer 2)
A real recording carries KB+ of audio (capturedBytes >> 1KB), so valid captures are UNAFFECTED; only genuine
stubs (< 1KB total) are now rejected. `capturedBytes` is summed on every non-zero dataavailable event and reset per
recording — reliable. Rejecting a stub is CORRECT: the rep gets an immediate honest "capture failed, re-record"
(outcome still logged as a knock, audioDropped), instead of a silently-doomed pitch that pollutes the list + KPIs.

## Honest limit (the un-fixed root cause)
This closes the SYMPTOM (no more doomed "corrupted" pitches; honest failure). It does NOT fix WHY iOS produces the
stub in the first place — reps on the affected path still can't capture until the root cause (the webm-vs-mp4
format selection; the failures are .webm despite a comment saying "iOS records mp4") is investigated. That is a
separate, larger fix — flagged as a critical residual.

## Session-read manifest (A22 — read_at ≥ started_at 13:45:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T13:46:00+08:00",
    "why_it_governs": "Understand WHY pitches fail from the record before changing the capture gate.",
    "how_this_build_will_embody_it": "Diagnosed from the STT error (size=5) + the isCaptureViable code; the fix targets the proven cause." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T13:46:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-57", "read_at": "2026-08-28T13:46:08+08:00",
    "why_it_governs": "Retrospective identification — the bug is on the record (failed pitches + the 5-byte error), not theorized.",
    "how_this_build_will_embody_it": "Read the actual failures + the code; the chunk-count-over-byte-volume hole is proven, not guessed." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-28T13:46:10+08:00",
    "why_it_governs": "Holistic — check every isCaptureViable caller before changing it.",
    "how_this_build_will_embody_it": "Grepped: DoorLog is the ONLY caller; the change is backward-compatible for any future one." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-28T13:46:15+08:00",
    "why_it_governs": "Layer 2 — the fix must reject stubs WITHOUT rejecting valid recordings.",
    "how_this_build_will_embody_it": "capturedBytes is KB+ for real audio; tests lock reject-stub + keep-real; only stubs fail the gate." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-28T13:46:18+08:00",
    "why_it_governs": "Proactive audit found this — a critical bug adjacent to the KPI/pitch work.",
    "how_this_build_will_embody_it": "The door-pitch health audit surfaced the 24% failure; this fixes the surfaced defect." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-28T13:46:20+08:00",
    "why_it_governs": "Honesty — a stub must yield an honest capture-failed, never a silently-doomed 'corrupted' pitch.",
    "how_this_build_will_embody_it": "A rejected stub becomes an honest re-record + a logged knock; the root cause is flagged, not hidden." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T13:46:25+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from the record, checked callers, used the tracked signal, flagged the root cause." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T13:46:30+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T13:46:35+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T13:46:40+08:00",
    "why_it_governs": "Gate the lesson — a regression back to chunk-count must fail a test.",
    "how_this_build_will_embody_it": "Tests assert a streamed 5-byte stub (capturedBytes=5, chunks=1) is NOT viable, and a real one IS." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T13:46:45+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + the live failure evidence." }
]
```
