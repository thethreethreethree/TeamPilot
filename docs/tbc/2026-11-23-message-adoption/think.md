---
started_at: 2026-11-23T10:40:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — ledger F18.1/F18.2 "Initiative board / adoption calculation" (LACK: hits stored per call, no mention-rate).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Message adoption on trackers

## The record

- keyword_trackers (0276): name, phrases, side, created_at; tracker_hits per (tracker, session, transcript_version, seq).
- scanSessionTrackers runs when a transcript lands (and after edits/trims); older calls only via the screen's scan offer.
- session_interaction_stats (0277): one row per (session, transcript_version), recomputed with the scan.

## Outside view

An adoption number lies if it counts calls the tracker never heard, counts a mention a correction removed, or turns a
partial read into a lower rate.

## Design

adoption.ts computeAdoption (calls since creation, current version, per rep and week); GET
/api/coach/remote/trackers/:id/adoption (caller client, paged, fail loud); TrackerAdoption panel per tracker.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "Understand before building: how hits are stored per transcript version, when a tracker scans (on landing; older calls only on request) and where a call's current version can be read cheaply were read first.",
    "how_this_build_will_embody_it": "The denominator and the current-version rule come from those facts, stated in adoption.ts."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "Layer 3: a manager who launches a message needs to see whether it lands, by rep and over time.",
    "how_this_build_will_embody_it": "Adoption on each tracker: overall share, weekly bars, per-rep table."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "Holistic: trims and corrections create new transcript versions; adoption must follow them.",
    "how_this_build_will_embody_it": "A call counts as 'said it' only on its current version (newest stats version)."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "Look past the task: counting backfilled older calls would mix heard and unheard calls.",
    "how_this_build_will_embody_it": "Only calls since the tracker was created count; unanalyzed calls are named, not counted as misses."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "External config can leave a number silently partial.",
    "how_this_build_will_embody_it": "None; reads are paged so a capped read can't cut hits."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "If the screen re-derived 'said it' its own way, it could disagree with the call page.",
    "how_this_build_will_embody_it": "computeAdoption in adoption.ts is the single rule."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "Derived from the record, not stored.",
    "how_this_build_will_embody_it": "Computed on read from hits and stats."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched (tracker_hits is already erased with a call)."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "An adoption table per rep could become a verdict on people; it must inform a coaching conversation, not replace it.",
    "how_this_build_will_embody_it": "Numbers only; no judgement on reps."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "Honesty: no calls is not 0%.",
    "how_this_build_will_embody_it": "'—' and 'No analyzed calls since …' when there are none."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "The counting rules and fail-loud are tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  },
  {
    "id": "A18",
    "source_file": "ThinkerThinker.md",
    "line_range": "431-445",
    "read_at": "2026-11-23T11:02:48Z",
    "why_it_governs": "Data about people shown to their manager: the label decides coaching vs penalizing.",
    "how_this_build_will_embody_it": "Per-rep rows are alphabetical with 'Listed alphabetically', no ranking."
  }
]
```
