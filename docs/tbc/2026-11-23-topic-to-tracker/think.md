---
started_at: 2026-11-23T22:05:03Z
trigger: Founder 2026-11-23 "keep building everything in the list" — ledger F14.4 "Turn a theme into a tracker" (LACK). Also measured: usage module columns left (OPEN.md note).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Turn a Market topic into a tracker

## The record

- Market topics carry a name and wordings (market.ts); POST /api/coach/remote/trackers { name, phrases, side } creates
  a keyword tracker (managers); { action: "scan" } scans the latest 50 calls.
- Production events (counts only): task 37, care 83 (11 with a person), no finance events; the usage module columns
  were left (OPEN.md note).

## Outside view

A theme you can see but not follow up on is half a feature; the trackers already exist.

## Design

MarketView: "Track" on each topic (managers, Remote Sales) → POST trackers with the topic's wordings on the customer
side → scan → "Tracking ✓" linking to Trackers; a refusal is shown inline.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "Understand before building: ledger F14.4 (LACK) — 'a theme can't be turned into a tracker'; Market topics (with their wordings) and the trackers create route (name, phrases, side) both exist.",
    "how_this_build_will_embody_it": "A one-click bridge using the trackers route unchanged."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T22:06:14Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "Layer 3: a manager who sees 'internet speed' rising wants to watch it on every call without retyping it on another page.",
    "how_this_build_will_embody_it": "'Track' on the topic; 'Tracking ✓' links to Trackers; recent calls are scanned so the tracker has hits at once."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "Holistic: the trackers route already checks the manager, normalises phrases and pins the company.",
    "how_this_build_will_embody_it": "No new route; Market calls it as the Trackers page does."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "Look past the task: a refused create (a duplicate name) must be visible.",
    "how_this_build_will_embody_it": "The route's own message is shown next to the topic; tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "Who may create trackers is decided by the trackers route.",
    "how_this_build_will_embody_it": "The button only shows for managers; the route still decides (requireSalesCoachManager)."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "Creating a tracker adds a record; the Market's own topics and counts must not change because one was tracked.",
    "how_this_build_will_embody_it": "A create plus a scan of recent calls."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Tracker phrases are topic labels, not one customer's words."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "Guide, don't overtake: the manager chooses which topics to track.",
    "how_this_build_will_embody_it": "A button per topic; nothing tracked automatically."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "Honesty: a tracker made from a topic label may match fewer spoken lines than the topic count suggests.",
    "how_this_build_will_embody_it": "The topic count stays the Market's; the tracker reports its own hits."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: a ledger LACK item using existing parts."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Render tests: the create body (wordings, customer side), the scan, the shown refusal, no button for reps."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T22:06:14Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
