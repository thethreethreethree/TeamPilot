---
started_at: 2026-11-23T21:11:33Z
trigger: OPEN.md erasure "a pipeline prospect never linked to a call keeps its name/organization after the customer is erased" (found 2026-11-23 in docs/tbc/2026-11-23-erasure-day-plans).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Legal erasure reaches unlinked pipeline prospects

## The record

- 0316/0317 rss_erase_sessions: prospects linked to an erased call lose name and organization ("(erased on request)")
  and their to-do Tasks are blanked.
- A prospect added from the pipeline and never linked is not reached.

## Outside view

The pipeline is often where a customer's name lives longest. Match it directly; show the admin the names, because an
organization can contain the customer's name for someone else.

## Design

0323 rss_erasure_prospect_matches + rss_erase_prospects (0316's step; completes when there are no calls). Route: find
returns prospects; erase takes prospectIds after day plans, before calls. Panel lists them, ticked by default.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "Understand before building: 0316 renames a prospect only through a linked erased call; the day-plan build found that a never-linked prospect keeps the customer's name and organization.",
    "how_this_build_will_embody_it": "Prospects are matched directly, with the same identifier pattern, and given 0316's exact treatment."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:14:09Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "Layer 3: one erasure review should show every place the customer appears.",
    "how_this_build_will_embody_it": "Prospects appear in the same panel, tickable, sent with the same erase."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "Holistic: invariant 38 (one path into erasure); 0316's prospect step already exists for linked calls.",
    "how_this_build_will_embody_it": "Same route, same request, ERASURE_EXTENSIONS entry; the step copies 0316's so the two cannot treat a prospect differently."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "Look past the task: an organization can contain a customer's name for a different person ('Betty Ross Holdings').",
    "how_this_build_will_embody_it": "The admin sees each prospect's name and organization and can untick one; tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0323 applied to production; grants read back live."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "What matches must be one rule for search and erase.",
    "how_this_build_will_embody_it": "rss_erasure_text_pattern (0322) for both; the erase re-checks the match."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "Prospect facts are append-only events.",
    "how_this_build_will_embody_it": "0316's erasure-aware rules apply; replayed: delete refused outside erasure."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "Only that customer's data, and the non-personal facts stay.",
    "how_this_build_will_embody_it": "Name and organization removed; stage, amount, dates stay; to-do titles blanked as 0316 does."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "Guide, don't overtake: the admin decides.",
    "how_this_build_will_embody_it": "Nothing erased without confirmation; any prospect can be unticked."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "Honesty: an erasure that leaves the customer's name in the pipeline is incomplete while reported complete.",
    "how_this_build_will_embody_it": "The pipeline is now searched and reported in the result ('removed them from N pipeline prospects')."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: 0316 already decided how a prospect is erased; this reaches the ones it missed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route tests (order, completion, refusal), render test (untick someone else), PGlite replay, invariant 38 allowlist."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:14:09Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
