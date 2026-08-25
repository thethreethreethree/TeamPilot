---
started_at: 2026-08-25T11:18:00+08:00
---

# THINK — close the empty-capture detection hole (client warns + records instead of creating a doomed pitch)

## The hole (from data, founder-approved this turn)
The empty-recording data showed: 7 pitches uploaded 5-byte stubs, yet there were 0 `doorlog.capture_failed`
telemetry events for that company — the client never flagged them. Root: `sawData` is set true by ANY
`ondataavailable` with size>0, so a 5-byte trailer reads as "saw data = success"; and the save gate
`hasAudio = !!(recorded.blob || chunksUploaded>0)` treats blob EXISTENCE as blob HAS-AUDIO — a truthy 5-byte stub
passes → a doomed pitch is created → it dies downstream as a misleading "corrupted", the rep is never warned, and
we get NO telemetry to diagnose the device cause. This is the [[reference_error_dressed_as_no_data_class]] shape at
the capture boundary and the [[feedback_recurring_failure_instrument_dont_assume]] instrumentation gap.

## The fix (grounded, buildable + verifiable now — the founder's chosen "close the detection hole first")
1. **Track the real signal.** `useDoorRecorder` sums `capturedBytes` across data events (a 5-byte trailer no
   longer masquerades as audio); it's added to `CaptureDiag` so the next occurrence's byte-volume is on the record.
2. **Gate the save on VIABILITY, not existence.** Shared pure `isCaptureViable({blobSize, chunksUploaded})` in
   `captureDiag.ts`: viable iff durable chunks uploaded (audio already safe in storage) OR the final blob ≥
   `MIN_VIABLE_AUDIO_BYTES` (1024 — a real recording holds media even for a fraction of a second; below this is pure
   container overhead). DoorLog's `hasAudio` now calls it. A non-viable capture takes the EXISTING honest no-audio
   path: report the CaptureDiag (telemetry) + log the disposition as a knock with the honest `audioDropped` notice —
   so the rep is warned to re-record and we capture the device cause, instead of creating a pitch that fails hours
   later as "corrupted".

Why a byte-viability check, not a duration floor: it respects the founder's "NO minimum length" rule
([[project_salescoach_no_minimum_length_2026_08_05]]) — a real ~1s pitch is several KB and passes; this only
catches captures with NO audio at all. Complements the server honesty guard (4c208231): client stops the doomed
pitch at source + warns the rep; server is the backstop for anything that still reaches it.

## Latency bearing (founder's new question this turn)
Empty/corrupted captures currently become pitches that CHURN 5 retries × exponential backoff before terminalising —
minutes each, skewing the after-pitch feedback average. Stopping them at capture (here) + failing them fast at the
server guard (4c208231) removes that tail. This fix is one input to the separate latency investigation to follow.

## A26 boundary
Class = "a recorder that treats a non-empty-but-empty capture as success." DoorLog is the surface with the
confirmed harm (doomed pitches). The shared `isCaptureViable`/`capturedBytes` live in the SHARED captureDiag module
so the live/meeting/care recorders can adopt the same gate; they don't create pitches from a blob, so they're not in
the doomed-pitch harm-class today — flagged for reuse, not force-fit (A24).

## A30 gate
Tests: `isCaptureViable` (chunks→viable regardless of blob; tiny blob + no chunks→not viable; blob ≥ threshold→
viable); `capturedBytes` carried in the diag. DoorLog render suite updated so its mock "recording" is a realistic
size (the 1-byte `Blob(["x"])` stand-in was unrealistic — a real recording is KB-scale).

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 11:18:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-25T11:20:10+08:00",
    "why_it_governs": "Understanding earned from data before solving.",
    "how_this_build_will_embody_it": "The hole was identified from the telemetry gap (0 events for 7 stubs), then fixed at the exact gate that let a stub through." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-25T11:20:12+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read fresh this build (prior reads were 24m stale for this dir's started_at)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-102", "read_at": "2026-08-25T11:26:30+08:00",
    "why_it_governs": "Layer 2 operational effectivity + layer 3 workflow continuity — a rep who records must end able to continue (warned to re-record), not stalled by a silent doomed pitch.",
    "how_this_build_will_embody_it": "A non-viable capture warns the rep + preserves the disposition as a knock, keeping the door-to-door flow moving instead of a hidden failure." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-162", "read_at": "2026-08-25T11:20:14+08:00",
    "why_it_governs": "THINK+search the class + its neighbors.",
    "how_this_build_will_embody_it": "Put the viability check in the SHARED module so adjacent recorders can adopt it; flagged (not force-fit) where they aren't in the harm-class." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-08-25T11:20:00+08:00",
    "why_it_governs": "Honesty is the moat — warn the rep + record the cause, don't silently create a failing pitch.",
    "how_this_build_will_embody_it": "A non-viable capture warns the rep (audioDropped) + emits telemetry instead of a hidden doomed pitch." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-437", "read_at": "2026-08-25T11:26:35+08:00",
    "why_it_governs": "Quick-decision checklist (understand-why, sweep, ripple).",
    "how_this_build_will_embody_it": "Ran it: understood the hole from data, swept the recorder class, traced ripple (fallback-path-only gate)." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-457", "read_at": "2026-08-25T11:20:20+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-596", "read_at": "2026-08-25T11:20:22+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-702", "read_at": "2026-08-25T11:19:50+08:00",
    "why_it_governs": "Sweep the class to its boundary.",
    "how_this_build_will_embody_it": "Named the class; put the fix in the shared module; flagged reuse for adjacent recorders." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-772", "read_at": "2026-08-25T11:20:24+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Unit tests pin isCaptureViable (both branches) + capturedBytes in the diag." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1003", "read_at": "2026-08-25T11:20:26+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
