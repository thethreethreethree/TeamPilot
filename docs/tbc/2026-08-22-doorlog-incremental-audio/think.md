---
started_at: 2026-08-22T07:24:00+08:00
---

# THINK — DoorLog: incremental (chunked) audio upload + wake lock — the REAL recording-loss fix

## What actually went wrong (and how I know)

The earlier "capture-loss" fix (506a93d0/e62e345a) made the OUTCOME survive an audio failure, and I over-claimed
it as fixing "didn't save on our end." It did NOT fix why the RECORDING fails on long calls — I misdiagnosed. Two
field reports + the live DB proved the real cause:

- Rep 1 (stale client): an 8-min recording "didn't save"; a shorter one saved.
- Rep 2 (newer client, no banner): "it was recording then it stopped."
- **Proof (48h, live `pitches`):** 34 pitches, exactly 2 lost their audio — and those 2 were **5.6 min and 21
  min**, the longest by far; every ~100s recording kept its audio. Dispositions were healthy (155 knocks). So
  it is specifically the RECORDING that dies on long calls.

Root cause (verified in code): DoorLog uploaded the **entire audio blob in one shot at Save** (single
`uploadToSignedUrl`). On a field connection a long recording's all-or-nothing upload fails/times out (Rep 1),
and separately the phone locking/backgrounding ends the mic track mid-call (Rep 2). The live-coaching path
already solved BOTH with 15s chunked uploads + recorder survival; DoorLog was never upgraded — and I even
recorded it "audited clean" on 08-21, an audit that missed the client upload robustness. §2 no-error-loops: the
identification was wrong; re-diagnose from the record, don't re-patch the same wrong spot.

## The fix (founder chose: upload during recording; additive)

Reuse the live path's proven, tested pattern:
- The recorder emits ~15s chunks that upload to storage **DURING** recording (so a long recording never rides on
  one big final upload, and whatever was captured before an early stop is already durable).
- A **screen wake lock** is held while recording so the phone doesn't lock/dim and kill the mic track (directly
  attacks Rep 2's "it stopped").
- The server **stitches** the chunks (reusing `orderedChunkSeqs` + `startsWithEbmlHeader` — the same
  contiguous-run / EBML-reseam semantics as the live path, so they cannot drift).
- **Additive:** the disposition (knock) save is untouched; the single-blob path remains as the FALLBACK when no
  chunk reached storage; audio is "present" when a blob OR ≥1 chunk exists (a recording that stopped early but
  streamed chunks is saved, not dropped).

## Honesty on verification (the founder's explicit gate: no "fixed" without proof)

Automated tests prove the WIRING (pure path/parse helpers, the chunk route's auth+company-scope+shape
validation, the consumer routing chunked→recordingId with no sign step, no regression on 70 existing doorlog
tests). The stitch reuses helpers already tested for the live path. What tests CANNOT cover: a real browser
recording streaming chunks on a throttled connection + the wake lock — that is the founder's on-device
verification, given as a precise protocol in the closure. I do NOT claim this "proven fixed" until that runs.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T07:25:04+08:00",
    "why_it_governs": "Understanding precedes solving — proved the cause from the DB record before building.",
    "how_this_build_will_embody_it": "The fix targets the proven cause (long single-shot upload), not a re-patch of the outcome." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T07:25:04+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read A19/A22/A30/A38 via Read this turn (07:25)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T07:25:04+08:00",
    "why_it_governs": "Layer-2 operational effectivity — the recording is the point, and it was being lost.",
    "how_this_build_will_embody_it": "Chunked-during-recording makes long recordings survive; the feature does its job." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T07:25:04+08:00",
    "why_it_governs": "Proactive audit — the second report revealed a distinct failure mode (recorder stops).",
    "how_this_build_will_embody_it": "Added the wake lock + early-stop durability in the same fix, not just the upload." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "205-235", "read_at": "2026-08-22T07:25:04+08:00",
    "why_it_governs": "No error loops — a failed fix means the identification was wrong; re-diagnose from the record.",
    "how_this_build_will_embody_it": "Instead of re-patching the outcome fix, I proved the real cause from the DB and fixed the upload." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T07:25:04+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: proved cause, traced ripple (additive; fallback preserved), stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T07:25:04+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this turn." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T07:25:04+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T07:25:04+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "New tests lock the storage layout, the parse helper, the route boundary, and the chunked-save routing." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T07:25:04+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran — and its honest LIMIT.",
    "how_this_build_will_embody_it": "Ran the full npm run check (in check.md); the on-device gap is stated, not papered over." }
]
```
