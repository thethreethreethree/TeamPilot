---
started_at: 2026-11-24T20:22:12Z
trigger: Ledger F15.5 "Mandatory questions and N/A" + OPEN.md rss-p3 "supports N/A per element"; founder picker 2026-11-24 "Managers, when correcting".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - A manager can mark a rubric item "Doesn't apply"

## The record

- scorePitch: Objection handling is skipped when no objection happens and Delivery is scaled 27 → 35.
- rescaleSection (remote/rubric.ts) was written for this and never used.
- pitch_score_elements.grade check: hit / partial / missed (0252). apply_pitch_score_override upserts the element row.
- Managers correct items from the dispute queue (DisputeQueue.tsx → /pitch-score/override).

## Outside view

N/A is a way to make a bad call look better; the founder kept it to managers, with a reason, on the record.

## Design

0331: grade 'na' allowed, worth 0. ElementGrade = Grade | "na" (enum-source). scorePitch: N/A points leave the section's
maximum; the section is scaled to full (Delivery already scaled when no objection). applyOverride: "na" valid for
elements, refused when it would make the whole section N/A. Readers: aggregate and patterns skip N/A; displays say N/A.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "Only Objection handling could be skipped; every other item cost points on calls where it couldn't happen (a hang-up before the close). The scorer, the override RPC, the stored grade check and every grade reader were read before changing anything.",
    "how_this_build_will_embody_it": "N/A follows the rubric's own Objection rule (scale the section over what applied), not a new formula."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T20:22:13Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "Holistic: a stored grade is read by the aggregate (rates), pattern history, key moments, Ask Coach, the score page, search and rep needs; a new value the readers don't expect would be counted as a miss.",
    "how_this_build_will_embody_it": "Each reader handled: aggregate and patterns leave N/A out; displays label it; search and rep needs already ignore it; the enum-source audit pins the type to the DB check."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "Layer 2-3: a manager answering a dispute picks 'Doesn't apply to this call', the score moves, the rep is told; nothing else in the workflow changes.",
    "how_this_build_will_embody_it": "One more option in the dispute queue's existing correction select; the same route, log and alert."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "Look past the task: marking every item in a section N/A would leave nothing to score it out of.",
    "how_this_build_will_embody_it": "Refused (section_all_na) with a plain message; tested."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None beyond migration 0331, applied and replayed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "scorePitch is the one authority on what a pitch is worth; the override path recomputes through it.",
    "how_this_build_will_embody_it": "N/A scaling lives in scorePitch only; applyOverride passes the grade through."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "Corrections are logged append-only (pitch_score_overrides) with old and new values and a reason.",
    "how_this_build_will_embody_it": "An N/A correction is a normal override row (new_value 'na', 0 points) with the manager's reason."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "Guide, don't overtake: who may mark N/A was the founder's decision.",
    "how_this_build_will_embody_it": "Picker 'Managers, when correcting'; the AI's parser still accepts only hit / partial / missed."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "Honesty: avoiding a step must not earn free points.",
    "how_this_build_will_embody_it": "Only a manager's reasoned, logged correction sets N/A; the rep is notified like any correction."
  },
  {
    "id": "§4",
    "source_file": "CLAUDE.md",
    "line_range": "414-426",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "A scoring change is a method change; it should not be believed to improve fairness until measured.",
    "how_this_build_will_embody_it": "Residual R1: watch how often N/A is used and on which items before calling it fairer."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The N/A decision was a picker."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "DB checks (grade set, na = 0 points), enum-source audit on ElementGrade, scorer/override/queue/pattern tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T20:22:13Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
