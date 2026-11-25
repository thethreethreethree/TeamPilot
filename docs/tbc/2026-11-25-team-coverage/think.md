---
started_at: 2026-11-25T11:37:20Z
trigger: Gong ledger F10.11 "Topic and tracker share per team" (P2, PARTIAL).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - What the team's calls cover

## Design

coverageShare.ts (pure): calls, trackers, hits, intel events → per-tracker and top-10 per-topic shares, MIN_CALLS 4.
GET /api/coach/remote/coverage?days=7|30|90 (managers; caller client; paged, chunked). TeamCoverage on Remote Sales →
Coaching, after Team call stats; rows link to Search.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "Ledger F10.11: a manager can't see how often the team's calls cover each tracker or topic — trackers exist and Search filters by them, but no share per team.",
    "how_this_build_will_embody_it": "A share per tracker and per topic over a period, counted exactly as Search counts, so each row opens the calls it counted."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T11:37:21Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "Holistic: a team read that went through the service role would bypass the tree and the hide just fixed.",
    "how_this_build_will_embody_it": "Every read goes through the manager's own client; the database applies both."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "Layer 3: with no trackers (production has none) the panel would be a dead end; a share links somewhere the manager can act.",
    "how_this_build_will_embody_it": "Empty trackers point to setting one up; each row opens those calls on Search for the same period."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "Look past the task: building this exposed that call AI reads in events weren't hidden (fixed in 0341); topic links match by words so can show more calls.",
    "how_this_build_will_embody_it": "0341 shipped first; the panel says a topic link can show a few more calls."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "The feature depends on intel events having the shape it reads.",
    "how_this_build_will_embody_it": "Production count: 316 of 316 intel events carry payload.intel.topics as an array."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "'Did a tracker fire on a call' and 'a call's topics' are already decided by Search.",
    "how_this_build_will_embody_it": "coverageShare counts the same way (any hit row; the latest intel read) — documented, tested."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "Shares must be derived from the record, never stored as edited state.",
    "how_this_build_will_embody_it": "Computed on read from hits and events; nothing written."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "Erasure blanks a call's AI reads; the shares must not resurrect erased words.",
    "how_this_build_will_embody_it": "Reads only current events and hits; topic labels come from those rows."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "Guide, don't overtake: a coverage share is the team's own norm, not a verdict.",
    "how_this_build_will_embody_it": "Shares with counts, no ranking and no target; below 4 calls no percentage."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The 4-call floor follows Gong's own documented floor; no new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Lib, route and render tests pin counting, company pinning, failure-as-500 and the floor."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T11:37:21Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
