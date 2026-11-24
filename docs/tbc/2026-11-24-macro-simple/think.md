---
started_at: 2026-11-24T00:23:16Z
trigger: Founder 2026-11-24 "'/Users/elostate/Downloads/General Sales Interface for Elostate.pdf' do not forget to incorporate the elements presented in this pdf"; picker "Macro Mode = PDF only".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Macro Mode is the PDF, nothing else

## The record

- The PDF (EVIDENCE.md, 3 pages): three call tabs; Highlights / Coaching / Next Meeting contents; "That's it. Nothing
  else. Super Simple."; pipeline top tabs Open $ / Closed Won / Closed Lost; per prospect to-do, stage, next call date,
  last call date, deal amount; braindump; manager sees reps' pipelines.
- Macro Mode (0303) implements it; RemoteSalesShell limits a rep's tabs to Today / Pipeline / Calls.
- Not filtered by Macro Mode: Pipeline views, Ask box, risk/sentiment lines, stage practice, lead source, expected
  close; Today's coaching checklist; call notes on the Macro call page.

## Outside view

Every one of those additions is useful, and together they are exactly the clutter the PDF was written against.

## Design

SimpleView (rep + Macro Mode on) hides them; managers and Macro Mode off see everything.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "Understand before building: the founder's General Sales Interface PDF (3 pages, read as images and text, EVIDENCE.md) is the source of Macro Mode; checked element by element against the code, and found the additions of 2026-11-23 showing inside Macro Mode's Pipeline, Today and call page.",
    "how_this_build_will_embody_it": "Only what the PDF lists stays in Macro Mode for a rep; the rest moves behind Macro Mode off."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T00:55:49Z; the PDF opened in full (EVIDENCE.md)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "Layer 3: the PDF's rep flow is Highlights → Coaching → (days later) Next Meeting, and a simple pipeline; extra panels interrupt it.",
    "how_this_build_will_embody_it": "Pipeline: tabs and the five fields; Today: brain dump and yesterday; call page: player and three tabs."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "Holistic: the same screens serve managers and reps, Macro Mode on and off.",
    "how_this_build_will_embody_it": "One SimpleView flag per screen: rep + Macro Mode on; managers and Macro Mode off unchanged; tested both ways."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "Look past the task: hiding a field must not hide data or break the record.",
    "how_this_build_will_embody_it": "Nothing is removed or changed in the data; the hidden fields keep their values and return with Macro Mode off."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None for this part."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "Whether the simple view applies is decided once per screen.",
    "how_this_build_will_embody_it": "simple = Macro Mode on and not a manager/admin, consumed by every hidden element."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "Display only; facts recorded by hidden fields stay on record.",
    "how_this_build_will_embody_it": "No writes changed."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "Guide, don't overtake: the founder decided (picker) how simplicity applies.",
    "how_this_build_will_embody_it": "'Macro Mode = PDF only' implemented as chosen."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "Honesty: the PDF's own words — 'That's it. Nothing else. Super Simple.'",
    "how_this_build_will_embody_it": "The rep's Macro Mode now matches them; pinned by tests."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Three pickers on the PDF's open points (simplicity, CRM send, research); founder chose Macro Mode = PDF only, company webhook, I'll find & you approve."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "RemotePipeline.simple.render.test.tsx pins the rep's simple view and the manager/off full view."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T00:55:49Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
