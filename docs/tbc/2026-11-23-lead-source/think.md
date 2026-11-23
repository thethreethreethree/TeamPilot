---
started_at: 2026-11-23T07:55:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next item, lead source / campaign analysis (gong.io capture M36 "Analyze deals by lead source/campaign (blog, chat, direct mail, event)", graded LACK: "No source field on prospects").
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Lead source on prospects

## The record

- Prospect facts are events (0303 remote_prospect_events, kind check: name, organization, stage, amount, next_call);
  the current state is the view remote_prospects_current; a new prospect is one transaction (0304 rss_create_prospect).
- Readers of the view: listProspects (explicit columns), the prospect detail route (select *), stage-practice,
  scenario stages, the call brief route.
- The session "client/campaign" label is free text per call, not per deal (grade note).

## Outside view

A source field fails if it fragments ("Webinar" vs "webinar "), if a win rate of 0% is shown for a source that simply
has no closed deals yet, if prospects with no source vanish from the totals, or if changing the view and function
breaks the app that is live until the push.

## Design

1. 0313: 'source' event kind (1-60 characters), source column appended to the view, rss_create_prospect gains a
   defaulted p_source (old 6-argument form dropped).
2. App: source on New prospect and the prospect card (suggesting names in use); the Ask box context includes it.
3. Pipeline → Sources: per source — prospects, open count and value, won count and value, lost, win rate on closed.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "Understand before building: how prospect facts are stored (0303 events), derived (remote_prospects_current), created (0304 rss_create_prospect) and read (listProspects, the detail route) was read first.",
    "how_this_build_will_embody_it": "The record section names each; source is added the same way as organization."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "Layer 3: a source must be settable where prospects are added and edited, and lead to an answer.",
    "how_this_build_will_embody_it": "Source box on New prospect and on the prospect; Pipeline → Sources shows the breakdown; the Ask box reads the source too."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "Holistic: the view and the create function have several readers and the live app still runs the old code until the push.",
    "how_this_build_will_embody_it": "The view gains source as its LAST column; the function keeps every old parameter and adds a defaulted one, so the deployed app's six-argument call still resolves; the full migration chain replays with 0 failures."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "Look past the task: a free-text field fragments into 'Webinar' / 'webinar '.",
    "how_this_build_will_embody_it": "Grouping ignores case and spacing; the source boxes suggest the names already used."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "A feature is not done while its migration waits outside the repo.",
    "how_this_build_will_embody_it": "0313 applied with db:apply; verify:live 32/32."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "The source rule lives in two languages.",
    "how_this_build_will_embody_it": "eventValue('source') mirrors 0313's check (1-60 characters, text); a test pins both limits and the replay shows the database refusing the same values."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "Where a prospect came from is a fact with history.",
    "how_this_build_will_embody_it": "A 'source' EVENT; the current value is derived (latest event); nothing is updated."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "Erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not used here; a reporter asking to be forgotten is filed (R3) rather than given an ad-hoc delete."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "A breakdown by source could tempt the product to tell reps which leads to chase; that judgement stays with them.",
    "how_this_build_will_embody_it": "The breakdown shows numbers only; no recommendation is made for the rep."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "Honesty: a source with no closed deals has no win rate, which is not 0%.",
    "how_this_build_will_embody_it": "Win rate is null until a deal closes and shows '—', with the rule written under the table; prospects without a source are their own row."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No founder decision was needed; the field mirrors existing prospect facts."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Breakdown arithmetic and the source rule are tests; the replay pins the database checks."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T08:09:40Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
