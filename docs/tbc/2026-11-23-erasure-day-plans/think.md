---
started_at: 2026-11-23T21:03:59Z
trigger: Founder 2026-11-23 "keep building everything in the list" — OPEN.md erasure "a rep's daily brain dump (remote_day_plans) may name a customer but has no call key, so erasure can't find it".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Legal erasure reaches reps' day plans

## The record

- Erasure route: find (rss_erasure_matches) → erase confirmed calls (audio first, then rss_erase_sessions).
- remote_day_plans (0303): dump text + organised plan jsonb; append-only; rep-only read (A10, no shadow read).

## Outside view

A customer named in a plan survives an erasure today. Showing the admin a rep's private plan would break 0303; deleting
whole plans would erase the rep's own words. Replace the identifier only, and show the admin that a plan mentions the
customer without its words.

## Design

0322: rss_erasure_text_pattern (shared), rss_erasure_day_plan_matches (plan id, rep, day), rss_erase_day_plans
(replace with "[removed]"; completes the request when there are no calls); erasure-aware rules. Route: find returns
dayPlans; erase takes dayPlanIds, re-checked against the search. Panel lists and sends them.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "Understand before building: erasure (0285, route) searches calls by phone/email/client name and erases call-keyed rows; remote_day_plans holds a rep's free-text plan, tied to no call, private to the rep (0303, A10).",
    "how_this_build_will_embody_it": "Day plans are matched with the same three kinds and erased within the same request and route."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T21:09:19Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "Layer 3: the admin erasing a customer should see every place they appear, in one review, and confirm once.",
    "how_this_build_will_embody_it": "Plans appear under the calls in the same erasure panel and are sent with the same erase."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "Holistic: invariant 38 allows one path into erasure; plans are private to reps; append-only rules must hold outside erasure.",
    "how_this_build_will_embody_it": "Same route, same request, ERASURE_EXTENSIONS entry with reason; the admin sees rep + day only; rules erasure-aware and proven to hold outside it."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "Look past the task: a customer may be only in a plan (no call); rss_erase_sessions refuses an empty list.",
    "how_this_build_will_embody_it": "rss_erase_day_plans records the completion itself when there are no calls; tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0322 applied to production and its grants and rules read back live."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "What 'mentions the customer' means must be one rule for search and erase.",
    "how_this_build_will_embody_it": "rss_erasure_text_pattern is shared by the match and the erase functions."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "Day plans are append-only; erasure is the one exception.",
    "how_this_build_will_embody_it": "Rules erasure-aware with 0285's exact pattern; replayed: refused outside erasure, applied inside."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "Erasure deletes that customer's personal data and nothing else, from a request an admin confirmed.",
    "how_this_build_will_embody_it": "Only the identifier inside each confirmed plan is replaced; the rep's other words stay."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "Guide, don't overtake: the admin decides what is erased.",
    "how_this_build_will_embody_it": "Plans are listed and tickable; nothing erased without confirmation."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "Honesty: an erasure reported as done must have reached what it says it reached; a limit nobody states reads as coverage.",
    "how_this_build_will_embody_it": "A plans-only erasure completes its request only after the plans are changed; the short-name limit is recorded in the closure and OPEN.md (not yet said in the panel — that is the OPEN.md next action)."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision needed: §3.1.1(2) and 0303/A10 together answer it — erase the identifier only, show the admin no plan text."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Route tests (search-limited, plans-only completes), render test, PGlite replay of matching/erasure/rules, invariant 38 allowlist."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T21:09:19Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
