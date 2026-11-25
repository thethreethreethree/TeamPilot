---
started_at: 2026-11-25T22:56:40Z
trigger: Gong ledger F11.4 "Preview against a sample" (P2, PARTIAL).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Tracker preview on 100 calls

## Design

preview route: CALLS 30 → 100; optional startsOn/endsOn filter the sample like the scan; transcripts read in chunks of
25 calls, each paged and ordered by session then seq. The form sends its dates.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "Ledger F11.4: the tracker preview checks 30 calls (Gong 100) and ignores the tracker's new dates; reading the route showed its transcript paging was ordered by line alone across calls.",
    "how_this_build_will_embody_it": "100 calls, inside the dates, read in a stable order."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T22:56:41Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "Holistic: a preview that disagrees with the real scan misleads the manager about what the tracker will catch.",
    "how_this_build_will_embody_it": "Same date window as the scan (0344 boundaries); same matcher as before."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "Layer 2: an unstable paged read can skip or repeat lines, so the preview's counts could be wrong.",
    "how_this_build_will_embody_it": "Ordered by call then line, in chunks of 25 calls (tested)."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "Look past the task: 100 calls of transcript is more rows; the read must stay bounded.",
    "how_this_build_will_embody_it": "Chunked reads, each paged; no AI used."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "No external configuration.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "The tracker's date window must mean the same in preview and scan.",
    "how_this_build_will_embody_it": "Same UTC day boundaries as trackerAppliesTo."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "A preview stores nothing; the record is untouched.",
    "how_this_build_will_embody_it": "Read-only, as before."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "A preview shows example transcript lines on screen; it must read only lines that still exist, so an erased call contributes nothing rather than a cached quote.",
    "how_this_build_will_embody_it": "It reads the current transcript view on each request and keeps nothing; erased calls have no lines to show."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "Guide, don't overtake: the preview informs the manager's choice.",
    "how_this_build_will_embody_it": "Unchanged behaviour beyond the sample and dates."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision; draft trackers recorded as not built."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route test pins the limit, the dates and the read order."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T22:56:41Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
