---
started_at: 2026-11-26T06:20:00Z
trigger: Gong ledger F11.3 (P2, PARTIAL) — "No call-type scope"; found on the way: adoption ignored tracker dates.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Tracker call types, and adoption that counts only what a tracker hears

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "Ledger F11.3: Gong trackers filter by call type; ours couldn't, so a video-only phrase ('share my screen') counted every phone call as a miss. Tracing where a tracker's scope applies showed adoption ignored the tracker's DATES too (0344): calls after an end date counted as 'didn't say it', so an ended campaign's rate kept sinking.",
    "how_this_build_will_embody_it": "Call types as a fixed tracker property, applied at the same points as dates; adoption counts only calls the tracker applies to."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T09:34:30Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "Holistic: a tracker's scope is read by the keyword scan, the smart scan, the smart backfill, the preview and adoption (one tracker's view and the board, by team). Missing one makes two numbers disagree.",
    "how_this_build_will_embody_it": "All five use trackerAppliesTo or the same context filter."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "Layer 3: a manager writing a tracker chooses its call types beside its dates; the list says the scope; 'Copy to form' keeps it.",
    "how_this_build_will_embody_it": "A 'Call types' select; ' · video calls only' on the list."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "Adjacent: keyword_trackers_live is `select *`, expanded at creation — without re-making it the scans would never see channels.",
    "how_this_build_will_embody_it": "0361 re-makes the view."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "0361 applied in production; verify:live passed.",
    "how_this_build_will_embody_it": "db:verify, db:apply, verify:live."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "Whether a tracker counts on a call is one verdict (trackerAppliesTo); adoption had re-derived it as 'since created' and dropped the dates term — the exact drift §2.2 names.",
    "how_this_build_will_embody_it": "computeAdoption consumes trackerAppliesTo."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "A tracker's scope never changes (the guard); a different scope is a new tracker, so past hits stay explainable.",
    "how_this_build_will_embody_it": "channels added to rss_guard_tracker_update."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; a tracker's call types store no customer text.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "The manager chooses the scope.",
    "how_this_build_will_embody_it": "Default both; no inferred scope."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "Honesty: an adoption rate that counts calls a tracker could never hear understates the team.",
    "how_this_build_will_embody_it": "Adoption leaves them out (tested)."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers. Call types are the existing phone/video contexts; custom call categories remain the founder's open decision and are not touched.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests: trackerAppliesTo by type, adoption by dates and type, create storage, the form."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T09:34:30Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
