---
started_at: 2026-08-27T09:05:00+08:00
---

# THINK — coaching stitch mislabels iOS mp4 as webm (drifted from its fixed DoorLog twin)

## Why (the record — a proactive audit of the iOS fix's neighbors)
After shipping the DoorLog iOS fixes, I audited the sibling capture path (§1.5.2 — a bug rarely lives alone). The
DoorLog stitch `stitchPitchAudio` was fixed on 2026-08-23 to PRESERVE the chunk's real content-type on the stitched
recording, because hardcoding `audio/webm` handed iOS mp4 bytes to STT labeled webm. Its coaching twin
`stitchSessionAudio` (live + meeting) still hardcodes `contentType: "audio/webm"` on the stitched upload
(stitchSessionAudio.ts:163). The two stitchers explicitly share their CONCATENATION helpers (orderedChunkSeqs,
startsWithNewRecordingHeader) "so the semantics can never drift" — but the content-type DECISION was duplicated, not
shared, and drifted: the DoorLog copy got the fix, the coaching copy did not (the §2.2 duplicated-condition-drift
shape).

## The chain (verified from code, not assumed — §1.2)
1. Coaching chunk route stores the chunk with its REAL type: `contentType: req.headers.get("content-type")`
   (`[id]/audio-chunk/route.ts:59`), and the client sends `blob.type` (= `audio/mp4` on iOS) (useLiveCoaching.ts:111).
2. `stitchSessionAudio.ts:163` OVERRODE that with hardcoded `"audio/webm"` on the stitched `recording.webm`.
3. `downloadAssetBytes` reads the stored type back (`contentType: data.type`, assets.ts:272).
4. The meeting dissect route + the live worker pass `dl.contentType` to STT (dissect route.ts:112) → iOS mp4 bytes
   labeled webm to ElevenLabs — the exact class the DoorLog twin was fixed for.

## Blast radius (§1.5.1 layer 2)
Only an iOS live/meeting session that reached the STITCH path — a drop / phone-lock / tab-close / never-Stop (the
"never lose the recording" durability path) — is affected. The clean-Stop path (`persistRecording`, uses `blob.type`)
already labels iOS mp4 correctly, so a normal Stop was never wrong. Narrow, but real, and squarely in the founder's
capture-reliability pain domain.

## The fix (§1.5 organic/holistic — minimal, mirror the proven twin)
Read the first readable chunk's `dl.contentType` and use it for the stitched upload (exactly `stitchPitchAudio`'s
shape). The storage KEY stays `.webm`-suffixed (an opaque, format-independent path); only the stored contentType must
be truthful for STT.

## Gate (A30) + honest limit
Two tests in stitchSessionAudio.test.ts lock it: an mp4-chunk stitch stamps `audio/mp4` (not webm); a webm-chunk
stitch stays `audio/webm`. The mock now models chunk contentType + captures the upload's. jsdom/mock can't prove
ElevenLabs accepts the relabelled bytes end-to-end — that's the same live-iOS proof the DoorLog fix rests on — but the
LABEL correctness (the drifted decision) is now locked on both twins.

## Session-read manifest (A22 — read_at ≥ started_at 09:05:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T09:22:00+08:00",
    "why_it_governs": "Understand the drift from the record before changing the stitch.",
    "how_this_build_will_embody_it": "Traced the full chunk→stitch→download→STT chain and named the drifted decision." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T09:22:15+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session (09:22-09:24)." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-08-27T09:22:30+08:00",
    "why_it_governs": "Retrospective — this came from reading the actual twin code + the DoorLog fix history, not theory.",
    "how_this_build_will_embody_it": "Every link of the chain confirmed against the source before calling it a defect." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-73", "read_at": "2026-08-27T09:28:00+08:00",
    "why_it_governs": "Organic + Holistic — fix minimally by mirroring the proven twin; never break a neighbor.",
    "how_this_build_will_embody_it": "The fix reuses the DoorLog twin's exact shape; no schema/route/consumer change." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "89-92", "read_at": "2026-08-27T09:22:45+08:00",
    "why_it_governs": "Layer 2 — the coaching recording must actually reach STT as a parseable file, not a mislabeled one.",
    "how_this_build_will_embody_it": "The stitched file now carries its true container so STT parses iOS mp4 correctly." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "150-152", "read_at": "2026-08-27T09:23:00+08:00",
    "why_it_governs": "Proactive audit — I looked at the fixed surface's neighbors, hypothesis first, then confirmed.",
    "how_this_build_will_embody_it": "Found + fixed the sibling drift the DoorLog fix left behind." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-316", "read_at": "2026-08-27T09:23:15+08:00",
    "why_it_governs": "The exact failure: a duplicated decision (content-type) drifted between two copies.",
    "how_this_build_will_embody_it": "Both twins now derive the label from the chunk's own type; a drift-guard test locks each." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T09:23:30+08:00",
    "why_it_governs": "Honesty — a mislabeled recording silently fails STT rather than delivering the review it promises.",
    "how_this_build_will_embody_it": "The true label lets the durability-path recording actually transcribe." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T09:23:45+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood the drift, traced consumers, mirrored the proven twin, gated both." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-27T09:24:00+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-27T09:24:10+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-27T09:24:20+08:00",
    "why_it_governs": "Gate the lesson — a prose-only fix (and its twin) returns.",
    "how_this_build_will_embody_it": "Content-type-preservation is now test-locked on the coaching stitch (its twin was already)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-27T09:24:30+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + EXIT code." }
]
```
