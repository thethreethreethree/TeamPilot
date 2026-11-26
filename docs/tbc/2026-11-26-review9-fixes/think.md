---
started_at: 2026-11-26T04:05:00Z
trigger: Independent review of 7ac4d39a..977e91ea (library usage, Ask Folder, win/loss, prospects read-all) — one confirmed medium (mentions compared deals that could never have one), the rest low.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Acting on the review of the library and win/loss builds

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "The review of 7ac4d39a..977e91ea traced 'By what was said': a deal with no call this person can read could never have a mention, yet was counted as 'not mentioned' — the comparison measured 'had calls', not 'this was said'. Hits from an older transcript version also counted.",
    "how_this_build_will_embody_it": "The mentions route keeps only hits on each call's current transcript version and returns withCalls; byMention compares only those deals."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T04:05:38Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "Holistic: askPipeline read deal sentiment for every deal, then kept 60; the prospect list's to-do link read was not paged and grouped links by a scan per deal; switching 'whose pipeline' briefly showed the previous person's deals.",
    "how_this_build_will_embody_it": "Sentiment only for the 60 read; links paged and grouped in a Map; deals deduped by id; the screen clears its data when the pipeline in view changes."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "Layer 2: folder usage counted plays from before the call was saved to the library, so 'heard by' overstated how the folder is used; the Ask Folder label said 'newest' when it means most recently saved.",
    "how_this_build_will_embody_it": "Plays count from the item's first save; the label says 'the 10 most recently saved calls'."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "Adjacent: deal-size thirds could split one amount across two bands.",
    "how_this_build_will_embody_it": "Cut points move past equal amounts (tested)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "No outside configuration is involved; all reads are existing tables.",
    "how_this_build_will_embody_it": "No outside config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "Which calls a person may hear is the database's verdict (RLS through the caller's client); the route consumes it rather than re-deciding.",
    "how_this_build_will_embody_it": "withCalls is derived from rows the caller's client returned."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "Read-path changes only: no table is updated or deleted, no event written.",
    "how_this_build_will_embody_it": "No new write path."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "No new stored customer text: counts and tracker names only.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "The win/loss tables guide by showing counts and leaving out rates below five closed deals, rather than asserting a conclusion.",
    "how_this_build_will_embody_it": "Unchanged; the note now says only deals with a call you can listen to are compared."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "Honesty: a comparison that counts deals that could never have a mention claims a difference it can't know.",
    "how_this_build_will_embody_it": "Only comparable deals are compared; too-few rows show no rate."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision: review fixes only."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row above was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests for current-version hits, comparable deals, tie cuts, sentiment for the capped set and listens before saving."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T04:05:38Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
