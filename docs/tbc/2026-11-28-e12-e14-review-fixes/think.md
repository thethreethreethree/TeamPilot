---
started_at: 2026-11-28T04:37:00Z
trigger: Independent review of E12, E13, revenue phase 9, E14 (a2fa79a2, ce5c2595, 8920159d, e9ed0405).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - E12–E14 review fixes

## PREFLIGHT
- methodology-present: CLAUDE.md FOUND · ThinkerThinker.md FOUND · docs/amendments FOUND
- scope: the deal route's maxDuration; runAgent's claim; loadDealCalls exclude; askCoach focus (keepLines); recommendedContacts reads; API `more`; the playbook note history (reviewer and route); tests.
- canonical-gate: `npm run check`

## UNDERSTANDING
- request-restated: fix what the review confirmed.
- why-this-problem-exists: each was right for the common case and wrong at a limit (time, a throw, the first N, a URL length, a page boundary).
- record-consulted: the review report; agents.ts, dealCalls.ts, askCoach.ts, recommendedContacts.ts, publicApiRead.ts, playbookReview.ts, the playbook and deal routes.
- conflicts-with-framework: NONE.
- ambiguities: NONE.

## FOUR-LAYER
1. build-structure: options on the shared loaders, not copies.
2. operational-effect: agents finish or record why; hidden calls don't crowd out heard ones; battlecards read the mentions.
3. synergetic-comp: the brief action gains the same hidden-first rule; the API's calls resource gains `more`.
4. surface: the battlecard's call header says when it kept the lines around the mentions.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-45",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Understand first: the independent review of a2fa79a2, ce5c2595, 8920159d, e9ed0405 traced each risk to its line: no maxDuration on the route that runs agents after the reply, an unwrapped claim, hidden calls filtered after the newest were picked, Ask Coach keeping only each call's opening, oldest-first truncation and long URLs, short pages without a 'more', and a capped note history.",
    "how_this_build_will_embody_it": "users carries no contact detail; the report's 429 column is named for what it counts (too fast)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before building.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md opened at read_at, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Holistic: the same read and grouping as the Market rows (readMarketInputs, norm via callsNaming), so the button reads the calls its row counts.",
    "how_this_build_will_embody_it": "One rule, imported, not re-derived."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-118",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Four layers: a report an admin can read beside the keys it describes, not a separate page.",
    "how_this_build_will_embody_it": "Table under the keys list in Settings → API keys."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Proactive: the item read is paged to the end, not a .limit (a page of scores can carry more than 1,000 item rows).",
    "how_this_build_will_embody_it": "Column renamed Too fast with a tooltip; library comment says why."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Fail loud: a hidden-call check that can't run fails the read (never lets every call through); a failed claim is recorded on its agent; an API page says whether more exist.",
    "how_this_build_will_embody_it": "usage 'failed' state; partial flag past 50,000 rows."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Single source: the hidden-call verdict (hiddenFrom) is consumed inside the one loader before picking, for both the brief and the playbook actions.",
    "how_this_build_will_embody_it": "stats filters rows by the returned set."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "343-352",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "A key never changes (0378's guard): the list is set at creation; a new list is a new key. Refusals are recorded in api_usage.",
    "how_this_build_will_embody_it": "No write in the usage route."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "353-370",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Erasure: the battlecard isn't stored; nothing new holds a customer's words.",
    "how_this_build_will_embody_it": "No new table; no ERASURE_EXTENSIONS entry needed."
  },
  {
    "id": "§3.2",
    "source_file": "CLAUDE.md",
    "line_range": "371-376",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "The gate on surfacing: stats are measurements, no problem is surfaced.",
    "how_this_build_will_embody_it": "Plain averages, no verdicts."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "377-390",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Guide, don't overtake: the battlecard is evidence from the team's own calls, each point cited, with no claim the calls don't make.",
    "how_this_build_will_embody_it": "Reps alphabetical, as teamCallStats returns them."
  },
  {
    "id": "§3.5",
    "source_file": "CLAUDE.md",
    "line_range": "398-411",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Measurement: the averages count only calls where a stat could be measured; null is not zero.",
    "how_this_build_will_embody_it": "teamCallStats rule kept; the API says phone and video only."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "440-485",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Checklist run before the build: decision already made by the founder picker (API + agents batch).",
    "how_this_build_will_embody_it": "No picker; built from the plan row."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Methodology in the working tree governs this build too.",
    "how_this_build_will_embody_it": "Read from the tree at read_at."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-610",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Citations require a session read.",
    "how_this_build_will_embody_it": "Every §/A cited here is in this manifest with an in-session read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-790",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "A lesson must sit in a gate: the route-gate and tenant-pin audits run over the new routes.",
    "how_this_build_will_embody_it": "npm run check includes invariant-audit."
  },
  {
    "id": "A31",
    "source_file": "ThinkerThinker.md",
    "line_range": "793-810",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Schema-complete is not built: the report must be reachable from the screen.",
    "how_this_build_will_embody_it": "ApiKeysPanel loads and shows it."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1020",
    "read_at": "2026-11-28T04:37:00Z",
    "why_it_governs": "Verified means the canonical command ran.",
    "how_this_build_will_embody_it": "npm run check, exit code read, before the commit."
  }
]
```
