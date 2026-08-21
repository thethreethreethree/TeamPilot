---
started_at: 2026-08-22T03:51:00+08:00
---

# THINK — Door Log: capture loss never drops the outcome + "Not Home" from the outcome screen

Two founder-urgent field reports (2026-08-22), both on Macro Mode's Door Log.

## Topic 1 — the trust bug: "Your last pitch didn't save on our end"

**Root cause (traced, not guessed).** A pitch is sent by `save()` → `sendPitch(body, blob)`. When the recorder
produced NO audio — `useDoorRecorder.stop()` resolves `{ blob: null }` on the capture-crisis seams (recorder
recreated mid-call, mobile lock, zero data chunks) — the old `sendPitch` did
`postDoorLog({ ...body, ...(blob ? { storagePath } : {}) })`, i.e. it OMITTED `storagePath`. But the server's
`PitchBody` schema REQUIRES `storagePath`, so the POST failed zod validation with a **400**. `failReasonFor(400)`
is `"server"`, so the rep saw the red **"didn't save on our end — tap to retry"** — and the ENTIRE pitch (the
sale, the outcome, the door) was rejected, not just the (nonexistent) audio. Worse: "tap to retry" was a lie —
the banner handler only dismisses, and `recorded` was already cleared, so there was nothing to retry. The rep
lost the disposition and was told, falsely, that they could get it back.

The same hole swallowed an upload failure: a non-null blob whose upload failed left `storagePath = ""`, which
PASSES `z.string()`, so the server created a hollow, audio-less pitch and kicked the worker on an empty path.

**Why this is layer-2 (does it actually work), not polish.** The Door Log's ONE job is to record what happened
at the door. A capture hiccup — common enough that we've been fixing its seams for days — was destroying the
record itself. That is a broken operational result, and it's exactly what "we look inadequate and unreliable"
names.

**The fix (right altitude).** A pitch IS its recording — the server is CORRECT to require audio for a pitch. So
the defect is the client trying to send an audio-less pitch. When there is no usable audio (null blob OR failed
sign/upload), `sendPitch` now preserves what actually matters by logging the DISPOSITION as a **knock** (drives
the KPI + records the outcome exactly like the existing no-mic path), and returns `audioDropped: true`. The rep
gets an honest AMBER heads-up ("Saved the outcome — but this pitch recorded no audio, so there's nothing to
review"), never a red failure — because the outcome DID save. A genuine server refusal still shows the red
banner, with copy that tells the truth (re-log the door; there is no retry queue).

## Topic 2 — the revision: "Not Home / No Answer" from the outcome screen

The rep's own words: he starts recording expecting contact, nobody comes out, and at Stop he's forced to pick
Sold / Go-Back / Not-Interested — "none of those cases are true for the situation." Fix: a **"Not Home / No
Answer"** action on the OUTCOME screen logs a no-answer knock and DISCARDS the recording, returning home. Added
`NO_ANSWER` as a legal `outcome → idle` transition so the flow stays a pure state machine (not ad-hoc setState).

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T03:51:53+08:00",
    "why_it_governs": "Understanding precedes solving — I traced the 400 from stop()->null blob->omitted storagePath->required schema, not a guess.",
    "how_this_build_will_embody_it": "The fix targets the traced cause (audio-less pitch), at the right layer (log a knock instead)." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T03:51:53+08:00",
    "why_it_governs": "Methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms via Read this turn before acting." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T03:51:53+08:00",
    "why_it_governs": "Layer-2 operational effectivity — the Door Log was destroying the record it exists to keep.",
    "how_this_build_will_embody_it": "The outcome is now preserved on every capture hiccup; the feature does its one job." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T03:51:53+08:00",
    "why_it_governs": "Proactive audit — while fixing the 400, notice the adjacent hollow-pitch and false-retry defects.",
    "how_this_build_will_embody_it": "Caught the empty-storagePath worker kick and the lying 'tap to retry' copy in the same pass." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T03:51:53+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: traced the cause from the record, stated the why, traced ripple (state machine + tests)." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T03:51:53+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38/A39/A40 via Read this turn (03:51)." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "327-347", "read_at": "2026-08-22T03:51:53+08:00",
    "why_it_governs": "Honesty is the moat — a save must never be dressed as a failure, nor a failure as a save.",
    "how_this_build_will_embody_it": "Amber heads-up for a saved-but-no-audio result; red only for a real refusal; killed the false 'tap to retry'." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T03:51:53+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38/A39/A40 via Read this turn (03:51)." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T03:51:53+08:00",
    "why_it_governs": "Encode the lesson in a gate, not just a commit message.",
    "how_this_build_will_embody_it": "A render test proves a null-blob capture saves the outcome as a knock (never a dropped pitch) with no red banner." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T03:51:53+08:00",
    "why_it_governs": "'Verified' names the canonical command you actually ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check; the exit-0 output is pasted in check.md." }
]
```
