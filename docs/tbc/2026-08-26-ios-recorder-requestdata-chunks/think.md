---
started_at: 2026-08-26T03:50:00+08:00
---

# THINK — iOS empty-capture ROOT: force chunks via requestData() (start(timeslice) is ignored on iOS Safari)

## Ground truth FIRST this time (§5 / instrument-don't-assume — the discipline I broke earlier, applied)
Founder, furious: the "no audio was recorded" banner STILL fires. I did NOT guess. I read the shipped capture
telemetry (`scripts/diag-capture-live.mjs`, doorlog.capture_failed events, last 48h): **12/12 empty captures are
iOS** (iPhone OS 18.7, Safari 26.x), across 3 reps / 3 companies. EVERY one:
- `mimeType = audio/webm;codecs=opus` (iOS 18 records WEBM — my earlier mp4 theory was wrong twice over)
- `chunkCount = 1`, **`chunksUploaded = 0`** — the incremental 15s-chunk upload NEVER fires on iOS
- `trackReadyState = ended` on the long recordings (durMs 90s–511s), while `wakeLock=true`, `hidden=0`

## The mechanism (from the code + the data, not assumed)
`useDoorRecorder.start()` calls `rec.start(AUDIO_CHUNK_MS=15000)` — the timeslice that is SUPPOSED to fire
`ondataavailable` every 15s so chunks upload during recording. **iOS Safari IGNORES the timeslice** — it fires
`ondataavailable` only once, at stop. So on iOS: no periodic chunks → `uploadChunk` never runs mid-recording →
`chunksUploaded=0` → the durability net (which exists precisely so a long recording survives an early track loss)
NEVER ENGAGES. Then iOS ends the mic track mid-pitch on a long recording (the `trackReadyState=ended`), and the
single stop-time chunk is empty/tiny (< the 1 KB viability floor) → "no audio". The whole safety mechanism was dead
on the exact platform (iOS) where the failures happen.

## The fix (addresses the CONFIRMED failure)
Force a chunk with `rec.requestData()` on an interval whenever the timeslice hasn't delivered one — the documented
iOS workaround. `requestData()` triggers an immediate `ondataavailable` WITHOUT stopping; its blob is a valid webm
CONTINUATION chunk that byte-concatenates like a timeslice chunk (the server stitch already handles this). Adaptive
via `lastDataAt`: a no-op on browsers that honor timeslice (Chrome/Android keep it fresh), essential on iOS (stays
stale → force each interval). Because `requestData()` flushes only the DELTA since the last emission, a chunk forced
right after a timeslice chunk is near-empty — never a duplicate/overlap. Result: partial audio becomes DURABLE from
~15s on, so even when iOS ends the track at minute 3 of a pitch, the first 3 minutes are already uploaded + stitched.

## Why this is robust regardless of WHY the track ends
I do NOT need to root-cause the iOS track-end (resource limits / an audio-session conflict with the analyser /
an interruption) to fix the LOSS: forced chunks make whatever-was-captured-before-the-end durable. The track-end
CAUSE remains a secondary, device-gated investigation (flagged); this fix recovers the audio either way.

## Ripple (holistic — §6 item 5)
- One added interval in the recorder; cleared in stop() + teardown (no leak). No server/schema/route change — the
  chunk-upload endpoint + stitch already consume these chunks.
- Non-iOS unaffected: the adaptive threshold means the force fires only when the timeslice isn't delivering.
- The clean-Stop full-blob fallback is unchanged (still resolves on stop).

## A30 gate
Test: with the timeslice NOT delivering (no ondataavailable), the force-interval calls `requestData()` after the
window; with data flowing, it does NOT. Fails if the interval is removed or the adaptive guard inverts.

## Honest limit
The REAL proof is a live iOS device (jsdom can't replicate iOS's timeslice bug) — the founder is actively testing on
iOS 18.7, so this ships for their immediate verification. The unit test guards the interval logic, not iOS itself.

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 03:50:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-26T03:53:20+08:00",
    "why_it_governs": "Understanding earned before solving — I read the telemetry ground truth before writing the fix.",
    "how_this_build_will_embody_it": "The fix targets the CONFIRMED failure (chunksUploaded=0 on iOS), not a guess." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-26T03:53:22+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read fresh this build." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "88-92", "read_at": "2026-08-26T03:53:24+08:00",
    "why_it_governs": "Layer 2 — does capture ACTUALLY work end-to-end on the real device? It didn't on iOS; the unit tests passed but the field failed.",
    "how_this_build_will_embody_it": "The fix makes iOS capture durable end-to-end; the founder verifies on a live iOS device." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "144-149", "read_at": "2026-08-26T03:53:26+08:00",
    "why_it_governs": "THINK from data, then fix.",
    "how_this_build_will_embody_it": "The OS tally (12/12 iOS) named the class; the fix is the iOS-specific mechanism." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-420", "read_at": "2026-08-26T03:53:28+08:00",
    "why_it_governs": "Knowledge ≠ intelligence / distrust the fast confident answer — I twice guessed mp4; the data refuted it.",
    "how_this_build_will_embody_it": "Named the cause ONLY from the telemetry (webm + chunksUploaded=0), not memory." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-436", "read_at": "2026-08-26T03:53:30+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood from data, traced ripple (non-iOS no-op, teardown), gated with a test." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-457", "read_at": "2026-08-26T03:53:32+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-596", "read_at": "2026-08-26T03:53:34+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-772", "read_at": "2026-08-26T03:53:36+08:00",
    "why_it_governs": "Encode the fix in a gate.",
    "how_this_build_will_embody_it": "A test pins the force-interval → requestData behavior." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1003", "read_at": "2026-08-26T03:53:38+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
