---
started_at: 2026-11-23T00:45:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next item, training by deal stage (gong.io capture M36 "Deliver just-in-time training based on pipeline stage and rep needs", graded NEW/LACK); founder picker the same day "Rep starts it".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Training by deal stage

## The record

- Training (0282): immutable scenarios (retire only), training_assignments (manager-assigned via service role; no insert
  policy; unique per scenario and rep), attempts recorded by the role-play route for ?assignment= practice.
- assigned_by readers: assignments GET (name shown "from …"), the role-play route (notifyTrainingAttempted, which
  already returns early when manager = rep), training.ts assignmentForRep.
- Stage names are free text per prospect (0303 stage event label), e.g. "Demo", "demo ", "Negotiation".
- Gong (pipeline-management page): just-in-time training by pipeline stage and rep needs. No further detail captured.

## Outside view

Free-text stages make matching fragile: "Demo" vs "demo " must match, and a manager must be able to pick names reps
really use. A rep must not be able to start arbitrary practice by naming any scenario; a manager must be able to tell
self-started practice from their own assignments; a failed read must not look like "nothing for this stage"; tags are
history, not a mutable list.

## Design

1. 0310: append-only training_scenario_stages (tag/untag events, normalised key enforced by a check constraint) and a
   security_invoker view of the tags in force; mfa_required restrictive policy (0309 rule).
2. Managers: GET/PUT /api/coach/remote/scenarios/stages; Training → Scenarios shows "For stages" chips with "+ Stage",
   offering the stage names already used on prospects.
3. Reps: GET/POST /api/coach/remote/stage-practice — the prospect must be the caller's own and open; the scenario must
   be tagged with its stage and active; the practice is an assignment with assigned_by = the rep, due on the next call
   (or in three days); starting twice returns the same one.
4. Lists say "you started this" (rep) and "(self-started)" (manager).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "Understand before building: how practice reaches a rep today (assignments only), how stage names are stored (free text per prospect) and who reads assigned_by were read first.",
    "how_this_build_will_embody_it": "The record section lists each; the founder's picker settled the one choice the record did not."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "Layer 3: practice must be one click from the prospect a rep is about to call, and land in the role-play.",
    "how_this_build_will_embody_it": "'Practice' starts it and opens practice?assignment=; a second click says Continue and goes to the same practice."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "Holistic: self-started practice reuses training_assignments, which managers' lists, the role-play route and notifications read.",
    "how_this_build_will_embody_it": "assigned_by = rep is shown as 'self-started' in both lists; the attempt notifier already skips self-notification; the practice route accepts it unchanged."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "Look past the task: the training screen it extends hid failed reads as 'No scenarios yet'.",
    "how_this_build_will_embody_it": "TrainingManager now says 'Couldn't load training' with Try again (F1)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "A feature is not done while it waits on config outside the repo; migration 0310 must be applied to production.",
    "how_this_build_will_embody_it": "0310 applied with db:apply and checked by the live invariants (check.md)."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "One rule for stage matching, in two languages.",
    "how_this_build_will_embody_it": "stageKey mirrors rss_stage_key term-for-term; the database check constraint refuses a key the rule would not produce (replay: 'bad key: refused')."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "Tags are facts over time: who set a stage on a scenario, and who removed it.",
    "how_this_build_will_embody_it": "training_scenario_stages is append-only (no-update/no-delete rules, replayed); current tags are a view."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "Erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched; briefs erased under it are simply absent from the read."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "Guide, don't overtake: the rep chooses to practise; nothing is assigned on their behalf.",
    "how_this_build_will_embody_it": "Founder picker 'Rep starts it': nothing appears unless a manager tagged it, and nothing starts unless the rep clicks."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "Honesty: a failed read must not look like 'no practice for this stage'.",
    "how_this_build_will_embody_it": "stage-practice returns 500 on any failed read (test); the card says 'Couldn't load practice for this stage'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "How a stage scenario reaches the rep went to the founder as a picker (answer: Rep starts it)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Ownership, tag-match and fail-loud are tests; ownership was mutation-checked; the live mfa invariant covers the new table."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T00:49:46Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
