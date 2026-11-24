---
started_at: 2026-11-24T21:21:35Z
trigger: Gong ledger F17.3 "Scenario from real calls" (P1, PARTIAL): manager writes scenarios by hand; ?fromSession= is unreachable.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Practice scenario drafted from a real call

## The record

- training_scenarios (0282) with source_session_id; scenarios POST validates the source call.
- TrainingManager reads ?fromSession= but no screen links to it (grep: only TrainingManager mentions fromSession).
- 0317: erasure retires call-built scenarios; their text stays stored.
- practiceScenario.ts: AI scenarios for door pitches (not saved).

## Outside view

The moment worth practising is in the call; making a manager retype it means it rarely happens.

## Design

ScenarioFromCallLink (managers, finished remote calls) → Training?fromSession. "Draft it from the call" → POST
/api/coach/remote/scenarios/draft → title, persona, situation, focus from the customer's lines (no personal details) →
the form; the manager edits and saves through the existing route.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "Ledger F17.3: stored scenarios can name a source call (?fromSession=), but nothing links there and the manager writes every field by hand; Gong's AI prefills from the call.",
    "how_this_build_will_embody_it": "A link from the call page and an AI draft from the call's customer lines, edited before saving."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T21:21:36Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "Holistic: a scenario built from a call is linked by source_session_id, which legal erasure uses to retire it (0317).",
    "how_this_build_will_embody_it": "The draft saves through the existing scenarios POST with sourceSessionId; drafting saves nothing."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "Layer 3: a manager hearing a call worth practising goes from the call to a ready scenario.",
    "how_this_build_will_embody_it": "Call page link → Training with the call → Draft it from the call → edit → Save."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "Look past the task: erasure only retires a scenario and keeps its text (0317), so a scenario drafted from a customer's words must not hold their personal details.",
    "how_this_build_will_embody_it": "The prompt forbids names, places, numbers and emails; stripPersonalDetails removes any that slip through; the manager reviews before saving."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None new; the AI key is the one coaching already uses."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "Who may draft from which call is decided by requireSalesCoachManager and getSession under the manager's own client (RLS + tree); whether AI may run by the guidance gate.",
    "how_this_build_will_embody_it": "The route branches on those verdicts and on r.suppressed."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "Legal erasure must keep covering stored copies of a customer's words.",
    "how_this_build_will_embody_it": "The draft carries no personal details by design and stays linked to its call, so erasure retires it as 0317 does."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "Honesty: no invented objections; a failed or suppressed draft is said, never filled with filler.",
    "how_this_build_will_embody_it": "The prompt works only from what the customer said; null drafts return a plain reason."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed: scenarios from calls already exist (0282); this fills in the missing link and prefill."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests pin the privacy prompt, the stripping, the gates before any AI call, the suppressed path and the form prefill."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T21:21:36Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
