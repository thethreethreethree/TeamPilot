---
started_at: 2026-11-26T06:30:00Z
trigger: Gong ledger F12.7 (P2, PARTIAL) — "Not built: … shared streams".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Shared saved searches (company streams)

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "Ledger F12.7: Gong streams are private or company; our followed searches were private only, so a manager who built a useful filter ('pricing objections, last 30 days') had no way to put it in front of the team.",
    "how_this_build_will_embody_it": "A manager shares a saved search; teammates see it and follow it, each counting with their own access."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T09:40:49Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "Holistic: a shared filter must never widen what a follower can see. Follow counts already run through the caller's own client (tree, hidden calls).",
    "how_this_build_will_embody_it": "Sharing shares the filter only; newMatches still runs per follower."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "Layer 3: a teammate finds the shared search where their own are, can follow it, and isn't offered actions they can't take.",
    "how_this_build_will_embody_it": "Listed under Saved searches with 'shared by Max'; no remove/share buttons on others' searches."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "Adjacent: following someone else's search must stop working once it's unshared; the owner removing it must take it away for everyone.",
    "how_this_build_will_embody_it": "The events route checks sharedNow; the list reads only not-removed searches."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "0362 applied in production with its MFA policy; verify:live passed.",
    "how_this_build_will_embody_it": "db:verify, db:apply, verify:live."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "Whether a search is shared is one verdict (sharedNow), consumed by the list and the follow check.",
    "how_this_build_will_embody_it": "Both call sharedNow."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "Sharing is a fact with history; saved searches are never edited.",
    "how_this_build_will_embody_it": "saved_search_shares rows (share/unshare), no-update/no-delete rules."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; a share stores ids only (the filter text already existed on the saved search).",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "The manager chooses what to share; teammates choose whether to follow.",
    "how_this_build_will_embody_it": "No automatic follows."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "No fixed behavior introduced.",
    "how_this_build_will_embody_it": "No defaults."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers. Managers-only sharing matches company library folders (managers curate company content).",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "No citation — and no allowlist reason — without reading the route: the events route's manager check gates sharing one's own search; it reads no rep's data.",
    "how_this_build_will_embody_it": "Reason written from the route as built."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: sharedNow, follow only while shared, managers-only share, the list, the screen."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T09:40:49Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
