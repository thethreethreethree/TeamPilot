---
started_at: 2026-11-25T00:10:07Z
trigger: Gong ledger F16.8 "Coaching metrics per manager" (P2, PARTIAL): fewer columns than Gong.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Coaching: calls with feedback, calls with comments

## The record

coaching-metrics: feedbackGiven (events by D8), callsListened (half played), byRep; CSV export of the same.

## Design

Distinct sessions per manager among D8 feedback events (calls with feedback) and among comment_sent_to_rep (calls with
comments). Panel and CSV columns.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "Ledger F16.8: per-manager coaching shows feedback given and calls listened; Gong also counts calls with feedback and calls with comments.",
    "how_this_build_will_embody_it": "Both counted from the events the route already loads, under the same D8 rule and window."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-25T00:10:08Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "Holistic: the panel and the CSV export come from the same route and must agree.",
    "how_this_build_will_embody_it": "Both get the two columns; the export test pins them."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "Layer 2: ten comments on one call and one comment on ten calls are different coaching.",
    "how_this_build_will_embody_it": "Calls with feedback counts distinct calls."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "Look past the task: the ledger note said there was no per-rep breakdown, which was built earlier today.",
    "how_this_build_will_embody_it": "Note corrected with this regrade."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "What counts as feedback is decided once (countsAsFeedback).",
    "how_this_build_will_embody_it": "The new columns use the same filter in the same loop."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "The export and render tests pin the new columns."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T00:10:08Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
