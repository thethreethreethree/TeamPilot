---
started_at: 2026-11-23T20:34:01Z
trigger: Founder 2026-11-23 "keep building everything in the list" — OPEN.md deal-risk "no close-date field, so no forecast by month".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Expected close date and the forecast by month

## The record

- Prospect facts are events (0303), kinds widened by 0313; remote_prospects_current derives the latest of each.
- forecast() gives one total; dealRisk has five checkable reasons. No date for when a deal should close exists.

## Outside view

A forecast without dates can't say when money arrives. A date the system guessed would be a claim it can't support;
the rep's own expected date is a fact the rep can be held to and update.

## Design

0320: 'close_date' kind ({date}), view column last. eventValue/route accept it. dealRisk: past_close_date reason;
forecastByMonth (past due apart, undated apart, expected only with the pipeline's own win rate). Card field, list row,
Forecast table, Ask box context.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "Understand before building: deal-risk's own residual said there is no close-date field, so no forecast by month; how prospect facts are stored (0303/0313 events, the current view, eventValue) was read first.",
    "how_this_build_will_embody_it": "The close date is one more prospect fact on the same path, not a new mechanism."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T20:37:23Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "Layer 3: a rep sets the date where they already set the next call; a manager reads it where they already read the forecast.",
    "how_this_build_will_embody_it": "Field beside Next call on the card; a by-month table inside Forecast; the date also shows on the list row."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "Holistic: the view is used by six routes and the kinds constraint by the erasure path.",
    "how_this_build_will_embody_it": "View appended (column last, all old columns unchanged); erasure untouched (a date is not customer words); replayed with every migration."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "Look past the task: the Ask box and the risk check read prospects too.",
    "how_this_build_will_embody_it": "The Ask box sees 'expected close'; a passed close date is a risk reason."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0320 applied to production (db:apply) before the push."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "One rule decides risk and the forecast; the screen must not re-decide.",
    "how_this_build_will_embody_it": "dealRisk/forecastByMonth in dealRisk.ts; the views only render them."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "A changed close date must not overwrite the old one.",
    "how_this_build_will_embody_it": "Each change is an event; the current date is derived (latest)."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "A date names no one; nothing to erase."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "Guide, don't overtake: the rep sets the expected date; the system never guesses one.",
    "how_this_build_will_embody_it": "No inferred dates; undated deals are counted apart."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "Honesty: a past-due deal quietly rolled into next month, or an 'expected' number without enough closed deals, would overstate the pipeline.",
    "how_this_build_will_embody_it": "Past due is its own row; expected is '—' below 5 closed deals; tested."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the build."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests pin the risk reason, the month buckets, the stored shape; the DB CHECK refuses a non-date."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T20:37:23Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
