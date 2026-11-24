---
started_at: 2026-11-24T01:11:48Z
trigger: Gong ledger F11.8 "Example-based smart trackers" (LACK); founder picker 2026-11-23 "One AI read per call". Scanner code begun earlier this session; 0329 applied 2026-11-23.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Smart trackers: the same idea in any words

## The record

- Keyword trackers (0276) match whole words; hits live in tracker_hits and feed the call chips, search and adoption.
- A transcript correction (0311) or speaker change (0328) makes a new version; readers show the latest version's hits.
- generateSessionArtifacts runs the keyword scanner when a transcript lands, is relabelled, trimmed or refreshed.

## Outside view

Matching meaning means an AI read, which can invent. The read may only point at lines, trackers and examples that
exist; anything else is dropped. Storing the customer's line would put their words outside erasure, so a hit stores
the example it matched.

## Design

0329: keyword_trackers.kind ('keyword'|'smart'), 1–10 examples for a smart one, kind immutable. smartTrackers.ts
(pure: examples, prompt, strict parse). smartTrackerScan.ts: one read per call for all active smart trackers (at most
10), hits with the line's time; carrySmartHits on a correction. Route: kind "smart", cap 10 (409), background
backfill of the last 10 visible sales calls for the new tracker only. Screen: "Exact words" / "Same idea, any words".

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "Understand before building: keyword trackers (0276) only match exact words, so a customer saying 'our Comcast deal doesn't end till June' is missed by a 'contract' tracker; the ledger grades example-based trackers (F11.8) LACK.",
    "how_this_build_will_embody_it": "Smart trackers hold example sentences and an AI read finds lines with the same meaning; hits go into the existing tracker_hits so every reader works unchanged."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T01:13:07Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "Holistic: tracker_hits feeds the call chips, search, the adoption views and the keyword scanner; a transcript correction makes a new version.",
    "how_this_build_will_embody_it": "The keyword scanner skips smart trackers; smart hits carry forward on a correction (carrySmartHits) so the latest version keeps them; the chip marks a smart hit 'like “example”'."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "Layer 3, workflow: a manager adds a tracker and expects to see it on calls already made, not only future ones.",
    "how_this_build_will_embody_it": "Saving a smart tracker reads the last 10 visible sales calls for it in the background and says so; new calls are read as their transcript lands."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "Look past the task: an AI read per tracker per call would multiply cost, and a backfill re-reading every tracker would re-bill the others and could add hits nobody asked for.",
    "how_this_build_will_embody_it": "One read per call for all smart trackers (founder picker); a backfill names its one tracker (onlyTrackerId)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "External config: the AI key is already required by every coaching engine.",
    "how_this_build_will_embody_it": "No new config; failures log and return null, and the screen still shows the tracker."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "Who may create and which calls a manager may backfill are decided once: requireSalesCoachManager and treeFilterReps; isSalesCall decides what is a sales call.",
    "how_this_build_will_embody_it": "The route branches on those verdicts; the scanner asks isSalesCall itself."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "Trackers and hits are append-only: a tracker's words and kind never change (0329 extends 0276's guard).",
    "how_this_build_will_embody_it": "Switch off and create a new one; hits are inserted, never updated."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "Legal erasure must keep covering every copy of a customer's words.",
    "how_this_build_will_embody_it": "A smart hit stores the tracker's example (the company's own words), never the customer's line, so erasure needs nothing new."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "Guide, don't overtake: the founder chose how calls are read.",
    "how_this_build_will_embody_it": "Picker 'One AI read per call'; managers write the examples."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "Honesty: the model can point at lines but must not invent them; trackers measure what was said and are not guidance, like keyword trackers in month 1.",
    "how_this_build_will_embody_it": "parseSmartHits keeps only real line numbers, the tracker's side and a listed example; the engine is control-exempt like keyword matching (measurement, not coaching)."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The reading approach was a picker."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "The examples cap and the immutable kind are database checks (0329); a test pins that no customer words are stored."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T01:13:07Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
