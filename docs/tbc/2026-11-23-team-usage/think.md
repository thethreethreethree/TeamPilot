---
started_at: 2026-11-23T09:14:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next item, platform adoption analytics (gong.io capture M36, graded PARTIAL: "Sessions and last-active per rep; no logins, active users or feature-use events").
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Team usage

## The record

- team-activity route (2026-08-27): per-rep session count and last active, Sales Coach managers.
- Records that already show use: login_attempts (email, succeeded; no company column; written by /api/auth/sign-in),
  coaching_sessions (agent_id), ask_coach_chats (owner_id) + ask_coach_turns (role user), training_attempts (rep_id),
  remote_prospect_events (actor_id). profiles carry no email.

## Outside view

Usage numbers become a league table if sorted; under-count silently if a read fails or caps; leak emails if the lookup
is careless; and cross teams if the reporting tree is skipped.

## Design

usage.ts buildUsage (7/30 days, active people, totals; alphabetical); GET /api/coach/remote/usage (managers; tree;
company-pinned; emails looked up server-side for sign-ins and not returned; caps reported); TeamUsage panel on
Remote Sales → Coaching.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "Understand before building: which records already show use (login_attempts, coaching_sessions, ask_coach_turns, training_attempts, remote_prospect_events) and how each names the person was read first.",
    "how_this_build_will_embody_it": "No new tracking: usage is counted from those records."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "Layer 3: a manager needs to see who isn't using the product, not just totals.",
    "how_this_build_will_embody_it": "Everyone in the tree is listed, including people with no activity, with last active."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "Holistic: a manager view across five tables must respect the reporting tree and tenant rules every other manager route does.",
    "how_this_build_will_embody_it": "Members filtered by treeFilterReps; every read pinned to the company and those people; emails used only to match."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "Look past the task: a usage page that silently drops a source would look like low adoption.",
    "how_this_build_will_embody_it": "Any failed read is a 500; a source that hits the 1000-row cap is named on screen."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "External config can make a count silently incomplete.",
    "how_this_build_will_embody_it": "Sign-ins count only the email-and-password form (other sign-in paths don't write login_attempts); the screen says so."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "If the screen and the route each decided what counts as 'active', the headline and the table could disagree.",
    "how_this_build_will_embody_it": "buildUsage() in usage.ts is the only place counts and 'active' are decided."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "Usage is derived from the record, not stored as a second copy that drifts.",
    "how_this_build_will_embody_it": "Nothing is written; counts are computed on read."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched; no personal data is stored."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "Guide, don't overtake: a usage table must not become a league table that judges people.",
    "how_this_build_will_embody_it": "Alphabetical, never sorted by count; the footer says it is usage, not a ranking."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "Honesty: under-counting must be visible, not silent.",
    "how_this_build_will_embody_it": "Caps are named; sign-in scope is stated."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Counting rules, tree and company pinning, email privacy and fail-loud are tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T09:24:14Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  },
  {
    "id": "A18",
    "source_file": "ThinkerThinker.md",
    "line_range": "431-445",
    "read_at": "2026-11-23T09:24:44Z",
    "why_it_governs": "Usage data about people shown to their manager: the label decides whether it invites coaching or penalizing.",
    "how_this_build_will_embody_it": "Labeled 'Team usage', alphabetical, with 'this is usage, not a ranking' under the table; no sort by count."
  }
]
```
