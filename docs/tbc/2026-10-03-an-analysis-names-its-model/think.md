---
started_at: 2026-10-03T05:10:00Z
trigger: Verifying the 9 re-queued pitches showed every pitch analysis stored with model "brain"; production has 100 analyses and all say "brain".
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - an analysis names its model

## The record

- Production, read-only: pitch_analyses model "brain" on 100 of 100 rows (90 doorlog-analysis-v2, 10 v1).
- `worker.ts` wrote `model: "brain"`; `analyze.ts` had `r.model` from runBrainCall (LlmResult.model) and dropped it.
- Sweep for the literal: `rollupWorker.ts` writes `model: "brain"` on every rep_pattern_summaries row the same way.
- DeepSeek renamed its models on 2026-07-25, so "which model wrote this" is a real question for these rows.

## Design

`analyzePitch` and `generateRepPatternRollup` return the parsed result plus `model`; the two writers store it.
Existing rows are not rewritten.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-03T05:10:22Z",
    "why_it_governs": "Understanding precedes solving: why does every analysis say 'brain'?",
    "how_this_build_will_embody_it": "Traced from the row back: worker.ts and rollupWorker.ts write the literal; analyze.ts and rollup.ts held r.model and dropped it. Printed in full at the recorded time."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-10-03T05:10:22Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter; the gate's opening printed."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-92",
    "read_at": "2026-10-03T05:10:22Z",
    "why_it_governs": "Four layers; layer 1 is whether the data shape is sound.",
    "how_this_build_will_embody_it": "A model column that holds one constant for every row is a shape that cannot answer its own question. Opening printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-150",
    "read_at": "2026-10-03T05:10:22Z",
    "why_it_governs": "Audit as you work; the adjacent instance.",
    "how_this_build_will_embody_it": "The sweep for the literal found the second writer (rep summaries) and it is fixed in the same build. Opening printed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-318",
    "read_at": "2026-10-03T05:10:22Z",
    "why_it_governs": "Consume the authority's answer, do not substitute your own.",
    "how_this_build_will_embody_it": "The model is the provider's answer (LlmResult.model); the writers now pass it on instead of a constant. Opening printed."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-10-03T05:10:22Z",
    "why_it_governs": "Full history must stay intact: retrospective analysis and data-as-asset depend on it.",
    "how_this_build_will_embody_it": "Which model wrote an analysis is part of its history; existing rows are left as they are (no rewrite of history), new rows carry it. Printed in full."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-03T05:10:22Z",
    "why_it_governs": "Item 0 asks whether this needs the founder's pick; item 1 whether the cause is understood from the record.",
    "how_this_build_will_embody_it": "No founder decision: a defect in what is recorded. Items 0-1 printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-10-03T05:10:22Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Heading printed at the recorded time; full text read 2026-10-02 03:59:58Z."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-597",
    "read_at": "2026-10-03T05:10:22Z",
    "why_it_governs": "A citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry states its coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-10-03T05:10:22Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "Reverting either writer to the literal fails a test (1 each). Heading printed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1004",
    "read_at": "2026-10-03T05:10:22Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md. Heading printed."
  }
]
```
