---
started_at: 2026-09-03T07:40:00+08:00
---

# THINK — long-meeting recordings silently lost (stitch fails on size + time)

## Why (founder emergency, diagnosed from the LIVE record — not theorized)
The founder's ~41-min meeting ("9/2 JOHN RAMOS.") sat for >1 day showing "recording isn't ready." Forensics
against the live DB + storage (scripts/diag-fm-*.mjs):
- The audio was FULLY captured: 163 contiguous chunks, valid webm header, one continuous recording, 37.3 MB.
- But `audio_asset_url` was NULL and the 163 chunks were never purged → the STITCH never completed.
- TWO independent root causes, both hit only by LONG sessions:
  1. **Size:** the stitched recording (37 MB) exceeds the `assets-v1` bucket `file_size_limit` (25 MB, 0062) →
     storage rejects the upload → stitch returns `stitched:false` → `audio_asset_url` never stamped.
  2. **Time:** the stitch downloads chunks SEQUENTIALLY — 163 chunks measured at ~145s — and the meeting-dissect
     self-heal does that IN-REQUEST, then also transcribes + runs the LLM under one 300s cap → killed before the
     stitch finishes.
- The clean-Stop full-blob path can't help either (a 37 MB blob exceeds the ~4.5 MB serverless body cap), so the
  chunk+stitch path is the ONLY path for a long session — and it was blocked. Every session longer than ~27 min
  (~0.9 MB/min → 25 MB) was silently unrecoverable.

## Understanding (§0, §1.2)
Not a transcription bug and not "wasn't recorded" — the capture worked; the ASSEMBLY step failed at the storage
size limit and the request time budget. Proven: after raising the limit + stitching out-of-band, the file
transcribes fully (34s, 37,030 chars, 13,756 words, 4 speakers) — the audio was always good.

## The fix (two layers + recovery)
1. **0241** — raise `assets-v1` file_size_limit 25 MB → 250 MB (~4.5h of audio). Governs only what storage
   accepts; the per-client-upload cap (AGENT_MAX_BYTES 25 MB, route code) is unchanged, so only the server-side
   stitch writes the larger file.
2. **stitchSessionAudio** — download chunks with bounded-concurrency PARALLELISM (145s → ~3s), preserving order
   and the exact stop-at-gap / stop-at-second-header semantics (only the fetch is parallel).
3. **Recovery** — out-of-band backfill of the 3 orphaned meetings that already hit this (founder's + 2 others),
   stitching with parallel downloads + stamping `audio_asset_url`. The founder's is transcription-verified.

## Honesty (§3.4, §5) — I did NOT claim "fixed" without proof
The founder was previously told a capture issue was "taken care of." This time the recovery is PROVEN end-to-end:
the actual ElevenLabs transcription of the recovered file was run and returned the real 41-min meeting content
before reporting it fixed (verify-fm-transcribe.mjs).

## Session-read manifest (A22 — read_at ≥ started_at 07:40; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T07:41:00+08:00",
    "why_it_governs": "Understanding precedes solving — diagnosed the real cause (size+time) from live storage/DB before any fix.",
    "how_this_build_will_embody_it": "Forensics proved audio present + stitch-upload rejected on size, not a phantom cause." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T07:41:20+08:00",
    "why_it_governs": "Methodology in the tree, consulted this session.",
    "how_this_build_will_embody_it": "CLAUDE.md in context; cited ThinkerThinker axioms re-opened this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T07:41:40+08:00",
    "why_it_governs": "Retrospective identification from the actual record.",
    "how_this_build_will_embody_it": "Root cause traced to bucket limit + sequential-download time, measured live (145s, 37MB)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T07:41:55+08:00",
    "why_it_governs": "Layer-2 effectivity — must ACTUALLY produce the content end-to-end.",
    "how_this_build_will_embody_it": "Ran the real transcription (34s, 37k chars, 4 speakers) as proof the meeting is recovered." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-09-03T07:42:10+08:00",
    "why_it_governs": "Honesty — never claim fixed without proof; never fabricate.",
    "how_this_build_will_embody_it": "Reported recovered only after the audio transcribed; no invented state." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "163-190", "read_at": "2026-09-03T07:43:20+08:00",
    "why_it_governs": "THINK-first + search adjacent — a bug rarely lives alone.",
    "how_this_build_will_embody_it": "After the founder's session, searched for OTHER orphans and found + recovered 2 more (Monday Focus, Meeting 1)." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "384-405", "read_at": "2026-09-03T07:43:35+08:00",
    "why_it_governs": "Recurring-failure honesty — the builder under pressure must not claim a fix that isn't proven.",
    "how_this_build_will_embody_it": "Ran the real transcription as proof BEFORE reporting fixed; owned the prior 'taken care of' miss." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-03T07:43:50+08:00",
    "why_it_governs": "Methodology in the working tree, not cited from cache.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session before citing." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-09-03T07:44:05+08:00",
    "why_it_governs": "Gate the lesson — a fix in prose alone recurs.",
    "how_this_build_will_embody_it": "The 19 stitch unit tests pin the semantics; REC-R1 flags the proactive-cron gate as the durable next step." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T07:42:25+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Diagnosed from record, traced ripple (both stitch trigger points + other orphans), verified." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-09-03T07:42:23+08:00",
    "why_it_governs": "Citations require session-reading.",
    "how_this_build_will_embody_it": "Re-opened A22/A38 this session; commit carries a Session-Reads trailer." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1004", "read_at": "2026-09-03T07:42:23+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md pastes the db:apply invariants, the vitest pass, and the live transcription output." }
]
```
