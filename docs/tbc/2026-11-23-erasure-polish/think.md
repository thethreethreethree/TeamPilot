---
started_at: 2026-11-23T21:15:20Z
trigger: OPEN.md erasure "a day plan that names the customer differently isn't found" (next action: say so in the panel) and docs/tbc/2026-11-23-erasure-day-plans residual R3 (bracket left behind).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Erasure: say the short-name limit; take the bracket

## The record

- Calls match the client name exactly (rss_erasure_matches); plans and prospects match any mention (0322/0323).
- rss_erasure_text_pattern for a phone started at the first digit, so "(555) 010-0123" left "(".

## Outside view

The limit is right but invisible where it matters. The bracket is cosmetic but looks like a broken erasure.

## Design

Panel hint for "Client name". 0324: phone pattern gains an optional leading "(".

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "Understand before building: two residuals of the day-plan erasure — the short-name limit was recorded but not said where the admin searches, and a bracketed phone left '(' behind.",
    "how_this_build_will_embody_it": "Say the limit at the search box; take the bracket in the one shared pattern."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:16:32Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "Layer 3: an admin who doesn't know a shorter name must be searched separately will believe the erasure was complete.",
    "how_this_build_will_embody_it": "A hint under the search when searching by client name."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "Holistic: rss_erasure_text_pattern is used by both day-plan and prospect matching.",
    "how_this_build_will_embody_it": "One change in the one function; both get it; 0322's scenario replayed against it."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "Look past the task: the hint must be accurate about which places match exactly and which match any mention.",
    "how_this_build_will_embody_it": "Calls: exact client name; plans and pipeline: any mention."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0324 applied to production; live checks re-run."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "One pattern decides what matches.",
    "how_this_build_will_embody_it": "Changed only inside rss_erasure_text_pattern."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "Append-only tables are untouched by this change.",
    "how_this_build_will_embody_it": "Pattern only; no rule changes."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "Erasure removes that customer's data and nothing else.",
    "how_this_build_will_embody_it": "The bracket belongs to the number; nothing else is taken."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "Guide, don't overtake: the admin needs to know what the search can't see to decide what else to search.",
    "how_this_build_will_embody_it": "The hint states it; the admin decides."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "Honesty: a known limit nobody sees at the point of use reads as completeness.",
    "how_this_build_will_embody_it": "Stated where the search happens."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: both were recorded residuals with named next actions."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Render test for the hint; PGlite replay shows the bracket removed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:16:32Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
