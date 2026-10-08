---
started_at: 2026-10-08T18:05:00Z
trigger: The R2-null-return-sweep residual (docs/tbc/2026-09-30-a-failed-save-says-why): readPitchScore returns null both when a call has no score and when the read failed.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - a failed read is not an unscored pitch

## The record

- Sweep of the 15 exported null-returning async functions in src/lib/coach. Two (analyzePitch,
  generateRepPatternRollup) merge causes that all get the same handling (retry later), which is harmless. List
  reads return [] on success, so their null already means an error. Two merge a read error with "not found":
  readPitchScore and readPitchRecordingDetail.
- readPitchScore: logs the error, returns null; GET /pitch-score answers `{ pitch: null }` 200; PitchScorePanel
  renders null as "unscored" and offers to score, a paid AI call, on a pitch that may be scored and unreadable.
  Its four follow-up reads ignore their errors (a failed elements read = a scored pitch with no evidence).
- readPitchRecordingDetail: error and not-found both answer 404 "Recording not found"; no paid action is offered,
  and the 404 is deliberate for not-yours. Left as is; recorded.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-08T18:05:58Z",
    "why_it_governs": "Understanding precedes solving: is a null here 'not scored' or 'could not read'?",
    "how_this_build_will_embody_it": "Traced from the panel back to the reader: the GET route returns { pitch: null } with 200 for both, and the panel turns null into 'unscored' with a Score button. Opening printed; full text read 2026-10-03."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-10-08T18:06:04Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter; the gate's opening printed at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-92",
    "read_at": "2026-10-08T18:06:04Z",
    "why_it_governs": "Layer 2: does the panel show the truth when the read fails?",
    "how_this_build_will_embody_it": "A failed read now reaches the panel as an HTTP failure, which it already renders as 'Could not load this pitch's score' with a retry, never a paid re-score. Opening printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-150",
    "read_at": "2026-10-08T18:06:04Z",
    "why_it_governs": "Audit as you work; the neighbour of the defect.",
    "how_this_build_will_embody_it": "The same reader ignored the errors of its four follow-up reads; fixed in the same build. Opening printed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-318",
    "read_at": "2026-10-08T18:05:58Z",
    "why_it_governs": "A verdict must say what happened; consumers branch on it.",
    "how_this_build_will_embody_it": "Null now means only 'no score'; a failed read is a distinct, named outcome (PitchScoreReadError) that both routes branch on. Printed."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-08T18:06:04Z",
    "why_it_governs": "Item 0: whether this needs the founder's pick; item 1: whether the cause is understood from the record.",
    "how_this_build_will_embody_it": "No pick needed: an internal correctness fix to an existing contract. Items 0-1 printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-10-08T18:06:04Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Heading printed; full text read 2026-10-03 13:38:55Z this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-597",
    "read_at": "2026-10-08T18:06:04Z",
    "why_it_governs": "A citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry names its print time and coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-780",
    "read_at": "2026-10-08T18:05:58Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "Tests on the reader and both routes; returning null on error again fails the reader test. INVARIANT 22 already polices catch-to-value; this was a return-to-value it could not see. Heading printed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-10-08T18:05:58Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md. Heading printed."
  }
]
```
