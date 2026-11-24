---
started_at: 2026-11-24T20:25:57Z
trigger: Gong ledger F10.7 "Activity stats" (P1, PARTIAL): no weekly hours on calls or total time per person.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Time on calls per person

## The record

- Team usage (usage.ts, /api/coach/remote/usage, TeamUsage.tsx): calls per person, 7 and 30 days, alphabetical.
- conversationDurationSeconds is the only source of a call's length (invariant).
- Production (counts only): 376 sessions — 92 with audio length, 64 with a usable start–end, 220 unknown; 0 in the last 30 days.

## Outside view

With most lengths unknown, a plain average would quietly undercount; the screen must say how many calls it counted.

## Design

UsageEvent.seconds for calls; PersonUsage.time7 / time30 = {seconds, timed}. Two columns: Time on calls (h m, * when
some calls are untimed) and Avg call (m:ss over timed calls).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "Ledger F10.7: Gong shows average call duration, weekly volume, weekly hours and total time per person; Team usage already counts calls per person for 7 and 30 days but no time.",
    "how_this_build_will_embody_it": "Time comes from the existing record (coaching_sessions) through the existing length authority; no new tracking."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T20:25:58Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "Holistic: Team usage's Calls column, its 1,000-row cap note and its 'not a ranking' rule all apply to the new columns.",
    "how_this_build_will_embody_it": "Same rows, same calls, same cap note; still alphabetical."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "Layer 2-3: a manager opening Coaching → Team usage expects how much time each person spent on calls in the window they picked.",
    "how_this_build_will_embody_it": "Two columns follow the 7 / 30-day switch already there."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "Look past the task: most stored calls have no known length; averaging them as zero would make the numbers lie.",
    "how_this_build_will_embody_it": "Measured (376 sessions: 220 with no known length); unknown lengths are excluded, counted and marked with *."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "A call's length is decided once, by conversationDurationSeconds (audio length, else a capped wall-clock span).",
    "how_this_build_will_embody_it": "The route calls it for every call; nothing re-derives a length."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "Honesty: never a fabricated number.",
    "how_this_build_will_embody_it": "A dash when no call has a known length; * and a tooltip when some don't."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed: the ledger item and the existing Team usage screen settle it."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "usage.test.ts pins that unknown lengths count as calls but not as time; the render test pins the * and the dash."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T20:25:58Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
