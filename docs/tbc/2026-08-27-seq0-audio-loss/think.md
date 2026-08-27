---
started_at: 2026-08-27T08:20:00+08:00
---

# THINK — seq-0 (header) chunk-loss discards a valid local blob → lost pitch audio

## Why (the record — a MEDIUM finding from the capture-reliability audit I ran)
Acting on the founder's acute pain domain (repeated "no audio recorded"), I ran an adversarial capture-reliability
audit over the Door Log recorder → save path. Most probes refuted (stuck pitch, serverless drop, chunk security all
sound). One CONFIRMED, MEDIUM:

**The stitch-vs-blob decision keyed on the wrong signal.** The recorder uploads ~15s chunks DURING recording (seq 0,
1, 2, …). seq 0 carries the container **header**; the server stitch (`stitchSessionAudio`) needs a contiguous run
**from seq 0** or it can't produce a parseable file. The client committed to the durable stitch path whenever
`chunksUploaded > 0 && recordingId` — i.e. if ANY chunk uploaded. So if seq 0 failed to upload (its retry exhausted)
but seq 1+ succeeded, the client:
1. saw `chunksUploaded > 0` → took the recordingId (stitch) path,
2. **discarded the good local clean-Stop blob** (which DOES contain the header), and
3. the server stitch then failed on the missing seq-0 header → the pitch terminalized as "no audio recorded".

Outcome integrity was safe (the knock/outcome always saved), but the **audio was lost** even though a
header-bearing blob existed locally the whole time. This is a §1.5.1-layer-2 miss: the feature "saved the pitch" but
did not deliver the intended result (a reviewable recording) in the seq-0-loss case, and did so **silently**.

## The fix (organic, minimal — the holistic/organic method)
Track whether **seq 0 specifically** reached storage (`seq0OkRef`), surface it out of `stop()` as `seq0Uploaded`, and
gate the stitch path on `chunksUploaded > 0 && seq0Uploaded && recordingId`. When later chunks uploaded but the header
did not, `seq0Uploaded` is false → the client falls through to the single-blob fallback (sign + upload the local
clean-Stop blob, which has the header) instead of a doomed stitch. Audio is preserved; nothing about the happy path
(all chunks land, seq 0 among them) changes.

## Holistic trace (§1.5 organic/holistic; §6 item 5)
- `useDoorRecorder.stop()` return type gains `seq0Uploaded` — three resolve() sites updated; every consumer is the
  DoorLog caller (checked: no other importer reads the tuple).
- DoorLog `recorded` state + `sendPitch` signature gain the boolean; the gate condition adds one AND term.
- Server route/worker/stitch: **unchanged** — the blob fallback path already exists and is exercised; this fix only
  routes to it in one more (previously-lost) case. No schema, no API contract change.

## Gate (A30 — the lesson encoded so it fails without my cooperation)
Recorder-level tests lock `seq0Uploaded`'s meaning: TRUE only when the seq-0 upload actually succeeds; FALSE when seq
0 fails even though a later chunk uploads (the exact defect). Two existing DoorLog render tests that simulated a
FULLY-successful streamed upload were made honest (`seq0Uploaded: true`) — a successful stream includes the header.

## Honest limit
jsdom can't reproduce a real iOS/Safari MediaRecorder or storage; the recorder tests mock `fetch` per-seq to drive the
seq-0-fail branch. They lock the client's routing LOGIC, not live storage behavior — the live proof is the founder's
iPhone field test (already-shipped iOS mp4 fix) plus `diag-capture-live.mjs`.

## Session-read manifest (A22 — read_at ≥ started_at 08:20:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T08:41:00+08:00",
    "why_it_governs": "Understand why the audio is lost (from the record) before changing the routing.",
    "how_this_build_will_embody_it": "Root cause named: stitch keyed on any-chunk, not the header chunk; fix targets that exact cause." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T08:41:20+08:00",
    "why_it_governs": "Methodology in the tree, read this build — not cached labels.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session (08:41-08:43)." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-08-27T08:41:40+08:00",
    "why_it_governs": "Retrospective identification — this came from auditing the real capture path, not theorizing.",
    "how_this_build_will_embody_it": "The finding is a confirmed probe against the actual recorder→stitch code, not a guess." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-73", "read_at": "2026-08-27T08:50:00+08:00",
    "why_it_governs": "Organic + Holistic — trace ripple before acting; fix iteratively/minimally, don't break a neighbor.",
    "how_this_build_will_embody_it": "Traced the single stop()-tuple consumer; the fix reuses the existing blob fallback (no server/schema change)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "89-92", "read_at": "2026-08-27T08:42:00+08:00",
    "why_it_governs": "Layer 2 — 'saved the pitch' must actually deliver a reviewable recording, not silently drop it.",
    "how_this_build_will_embody_it": "Fix routes the seq-0-loss case to the header-bearing blob so the audio is preserved end-to-end." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "148-152", "read_at": "2026-08-27T08:42:20+08:00",
    "why_it_governs": "Proactive audit — I ran the capture audit in the founder's acute pain domain and act on what it confirmed.",
    "how_this_build_will_embody_it": "MEDIUM finding fixed + gated; refuted probes left unchanged (no gold-plating)." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T08:42:40+08:00",
    "why_it_governs": "Honesty — a lost recording must not masquerade as a saved-but-empty one when a good blob existed.",
    "how_this_build_will_embody_it": "The blob fallback preserves the audio; the 'no audio' terminal is reserved for genuine no-audio." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T08:43:00+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood from the record, traced the single downstream consumer, gated the class." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-27T08:43:10+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-27T08:43:20+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-27T08:43:30+08:00",
    "why_it_governs": "Gate the lesson — a prose-only fix returns.",
    "how_this_build_will_embody_it": "seq0Uploaded's meaning is locked by two recorder tests exercising both branches." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-27T08:43:40+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + EXIT code." }
]
```
