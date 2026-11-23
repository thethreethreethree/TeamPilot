---
started_at: 2026-11-23T00:35:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next item, the team call calendar (gong.io capture M36 "Activity Calendar: quick view of customer conversations across team members", graded NEW/LACK).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Team call calendar

## The record

- Booked calls exist already: each prospect's next_call_date (0303; remote_prospects_current via listProspects). Today
  shows only today's (day route); the Pipeline list shows one date per row. Nothing shows a week, or a team.
- Held calls are coaching_sessions in REMOTE_CONTEXTS (video, phone), started_at, agent_id, client_label, outcome
  (sold | follow_up | no_sale | no_contact | undecided); their prospect is in remote_prospect_calls (unique per session).
- coaching_sessions RLS (0273) lets a rep read their own and a manager their tree; the prospects read follows the same.
- Time zones: the day route takes the browser's getTimezoneOffset() (clampOffset) and turns a local day into UTC bounds
  (dayBounds). The capture (press page, remote-selling relief package) gives one line: a quick view of customer
  conversations across team members.

## Outside view

A calendar that is quietly wrong is worse than none: a call at 10pm in New York filed under the next day (UTC); a
failed read shown as an empty, calm week; a manager seeing calls of people outside their tree; an entry you can't
click through. A new calendar integration (Google/Outlook) is a different build (ledger F4) and not needed to show what
the record already holds.

## Design

1. GET /api/coach/remote/calendar?week&scope&tz — Monday-first week; caller's client only; scope as the Pipeline's
   "Whose pipeline" (mine | team | rep id). Any failed read → 500.
2. Booked: open prospects whose next call date falls in the week. Held: remote sessions whose start falls in the local
   week bounds, bucketed by the viewer's local day, with their prospect's name.
3. Pipeline page: List | Calendar toggle; calendar keyed by "whose"; booked → open the prospect on its tab; held → the
   call page.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "Understand before building: where booked calls already live (next_call_date), how held calls are stored and how the day route handles time zones were read first.",
    "how_this_build_will_embody_it": "The record section names each source; the design reuses dayBounds/clampOffset rather than a new time-zone rule."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "Layer 3: a calendar entry must lead to the thing — the prospect or the call.",
    "how_this_build_will_embody_it": "Booked entries open the prospect in the list on its tab; held entries open the call page."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "Holistic: the Pipeline page gains a second view; its list, Ask box and prospect opening must keep working.",
    "how_this_build_will_embody_it": "The list is unchanged inside the List view; one goTo() serves the calendar and the Ask box, and also fixes the Ask box opening a closed prospect on a hidden tab (F1)."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "Look past the task: the just-shipped Ask box had the same 'open a prospect' path.",
    "how_this_build_will_embody_it": "Found while wiring goTo(): a cited Closed Won/Lost prospect opened on the Open tab, i.e. not visibly; fixed here (F1)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "A feature that depends on config outside the repo is not done until that config is verified; this one must be checked for any such dependency.",
    "how_this_build_will_embody_it": "build.md: no migration, env key or dashboard setting."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "One rule for 'which local day': the day route's dayBounds/clampOffset.",
    "how_this_build_will_embody_it": "The route uses the same helpers; localDay is their inverse and is tested against them."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "The pipeline state read here is derived from appended prospect events; a read-only view must not add an update path.",
    "how_this_build_will_embody_it": "Nothing is written; the route reads remote_prospects_current, coaching_sessions and call links."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "Erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched; briefs erased under it are simply absent from the read."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "Guide, don't overtake: a manager's team view must inform, not act on a rep's pipeline for them.",
    "how_this_build_will_embody_it": "The calendar shows facts only; no suggestion, no automatic change."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "Honesty: an empty week must mean no calls, not a failed read.",
    "how_this_build_will_embody_it": "Any failed read is a 500 and the screen says 'Couldn't load the calendar' with Try again (test)."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Founder's standing instruction 'keep building everything in the list'; no new decision needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Fail-loud and the time-zone sign are tests; the sign test was mutation-checked."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T00:39:32Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
