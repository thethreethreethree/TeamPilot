---
started_at: 2026-11-23T11:33:50Z
trigger: Founder 2026-11-23 "keep building everything in the list" — OPEN.md "topic labels fragment ('Price' vs 'pricing concerns')" (docs/tbc/2026-11-23-market).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Group similar topics on Market

## The record

- Production (read-only probe, labels and counts only): 720 distinct topic labels across 1,430 mentions in
  coach.session_intel_generated. Many differ only in wording: "internet and tv bundle" (25) / "internet and tv
  bundling" (5) / "tv and internet bundle" (4) / "bundled internet and tv" (2); "pricing" (54) / "price" (2);
  "internet speed" (64) / "internet speeds" (6).
- market.ts groups topics by lower-cased exact text only.

## Outside view

Fragmented topics understate what customers actually raise. But a grouping that merges different things (e.g. "price
increase" into "pricing") overstates it. The safe rule merges wording, not meaning; the screen should show what was
merged.

## Design

topicKey: lower-case, punctuation to spaces, drop small words (and, the, of, vs…), match word endings (-s, -ing, -ed,
trailing e; not -eed), ignore order. Prototype on production: 720 → 669 groups, 41 merges, all inspected, none wrong.
Topics carry `variants` (the other wordings); MarketView shows them.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "Understand before building: the real topic labels in production were counted first (720 distinct labels for 1,430 mentions) and a grouping rule was tried against all of them before writing code.",
    "how_this_build_will_embody_it": "Only the rule that produced no wrong merge on the real labels is built."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T11:34:49Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "Layer 2/3: a manager reading Market should see one 'internet and TV bundle', not five rows of the same topic.",
    "how_this_build_will_embody_it": "Grouped topics with the other wordings shown underneath."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "Holistic: the grouping must not change competitors (names, not phrases) or any stored data.",
    "how_this_build_will_embody_it": "Only the topics list in computeMarket uses topicKey; competitors keep their own key."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "Look past the task: the prototype showed the bigger split is meaning ('pricing' vs 'monthly bill'), not wording.",
    "how_this_build_will_embody_it": "Not guessed at; logged as a residual needing a decision on synonyms."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "One rule decides 'same topic'; the panel must not regroup on its own.",
    "how_this_build_will_embody_it": "topicKey in market.ts; the panel only renders groups and their wordings."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "Topics are stored per call as events; grouping must not rewrite them.",
    "how_this_build_will_embody_it": "Grouping happens at read time; events untouched."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "Guide, don't overtake: a merge the manager can't see would assert a sameness they never agreed to.",
    "how_this_build_will_embody_it": "Each grouped topic lists the wordings it combined."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "Honesty: grouping that merges different topics would overstate a topic's share.",
    "how_this_build_will_embody_it": "Conservative rule (word order, small words, word endings only); every merge on the production labels was inspected; tested."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Unit tests pin the merges seen in production and the non-merges."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T11:34:49Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
