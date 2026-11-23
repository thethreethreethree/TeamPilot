---
started_at: 2026-11-23T21:17:31Z
trigger: OPEN.md calendar "booked calls show a date only (a prospect's next call has no time)".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - A time on the next call

## The record

- next_call events hold { date } (0303); remote_prospects_current.next_call_date; calendar lists booked calls per day;
  ics.ts builds all-day events with a reminder 15 hours before.

## Outside view

A booked call without a time is a reminder the evening before for a call at an unknown hour.

## Design

0325: next_call value may carry "time" (HH:MM, CHECK); view column next_call_time. eventValue accepts { date, time }.
Card: time input beside the date (each sends both). List row, calendar (time order), Ask box, .ics (floating 30-minute
event, 15-minute reminder).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "Understand before building: a next call is a 'next_call' event with a date (0303); the calendar and the .ics reminder read it; no time exists anywhere.",
    "how_this_build_will_embody_it": "The time joins the same event, so date and time stay one fact."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:20:21Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "Layer 3: a rep who books '3:30 Tuesday' needs the reminder at 3:15, not the evening before.",
    "how_this_build_will_embody_it": "Timed .ics event with a 15-minute reminder; the calendar lists a day's calls in time order."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "Holistic: the call screen (MacroCallView) also sets next_call with a date only; the view is read by six routes.",
    "how_this_build_will_embody_it": "Date-only stays valid (it clears the time — a new booking); the view gains a column at the end only."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "Look past the task: changing the date on the card must not silently drop a time the rep set.",
    "how_this_build_will_embody_it": "Each card input sends both values; tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0325 applied to production before the push."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "What a valid next call is has one rule.",
    "how_this_build_will_embody_it": "eventValue (route) and the 0325 CHECK agree: HH:MM 00:00–23:59; tested both sides."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "A new booking is a new event, never an edit.",
    "how_this_build_will_embody_it": "The latest next_call event holds both date and time."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "A time names no one; nothing to erase."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "Guide, don't overtake: the rep sets the time; nothing is inferred.",
    "how_this_build_will_embody_it": "Optional field; untimed calls stay all-day."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "Honesty: a time shown in the wrong zone would be a wrong reminder.",
    "how_this_build_will_embody_it": "Times are the rep's local time and the .ics is 'floating', so their own calendar places it."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: the residual named the build."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Unit tests (eventValue, ics, calendar order), render test (both inputs send both values), DB CHECK replayed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:20:21Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
