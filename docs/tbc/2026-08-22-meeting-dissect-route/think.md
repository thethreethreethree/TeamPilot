---
started_at: 2026-08-22T00:26:40+08:00
---

# THINK — Meeting Dissect route (Phase-6 wiring, step 2: the trigger)

Makes the post-meeting Dissect REACHABLE. A meeting persists no live transcript (the durable audio is source of
truth), so `POST /api/coach/meeting-session/[id]/dissect` produces the review from a BATCH re-transcription of
the audio WITH diarization — which also realizes the N-party speaker attribution the live single-mic stream
couldn't (Decision #1's enhancement, post-hoc). The stored `meeting.dissect_generated` event is the CACHE: an
existing one is returned WITHOUT re-charging STT/LLM (the sales retranscribe cost-loop lesson); `?force=1`
regenerates. Owner-gated (facilitator's own meeting), meeting/huddle only, `maxDuration` 300 for batch STT.

Reuses `transcribeWithDiarization` (numSpeakers omitted → auto-detect N participants, vs the sales 2-party pin),
`assetUrlToStoragePath` + `downloadAssetBytes`, and `generateAndStoreMeetingDissect`. Next: the review UI +
the improvement-trend aggregate.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Understanding precedes solving — reused the proven sales retranscribe flow after reading it.",
    "how_this_build_will_embody_it": "Mirrors the retranscribe download→diarize flow; the stored-event cache mirrors its cost-avoidance." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The trigger is what makes the measurement + store actually reachable end-to-end (layer-2).",
    "how_this_build_will_embody_it": "The route ties audio→diarize→generate-and-store→return so the Dissect is invocable, not just a lib." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Carry the proven cost-avoidance discipline, not just the happy path.",
    "how_this_build_will_embody_it": "The stored-event cache (+ ?force) prevents re-charging STT on every review, per the sales cost-loop lesson." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood the retranscribe flow, traced ripple (reused helpers, events cache), stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session before this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Encode the lesson in a gate — the stored-event cache is the encoded cost-loop fix.",
    "how_this_build_will_embody_it": "A prior dissect short-circuits the route before any STT/LLM charge." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3588 tests, exit 0), pasted in check.md." }
]
```
