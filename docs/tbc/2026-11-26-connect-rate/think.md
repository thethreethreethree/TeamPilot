---
started_at: 2026-11-25T22:08:52Z
trigger: Gong ledger F25.8 "Outcome connect status and sentiment" (P1, PARTIAL).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Connect rate per rep

## Design

outcomeConnected(outcome) in outcomeLabels.ts (No contact = false; Sold/Follow-up/No sale/Undecided = true; else null).
usage.ts: reached7/reached30 per person from phone/video calls. Usage route selects context and outcome. TeamUsage:
"Reached" column.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "Ledger F25.8 (P1): outcomes have no connected/not-connected attribute, so there is no connect rate; sentiment exists only as the colour tone (founder picker 2026-11-25).",
    "how_this_build_will_embody_it": "outcomeConnected beside outcomeTone; a Reached column in Team usage."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "Sections printed by line at 2026-11-25T22:08:53Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "Holistic: usage counts every call kind; a connect rate over door pitches and meetings would mean something else.",
    "how_this_build_will_embody_it": "Only phone/video calls with an outcome are judged; door and meeting sessions aren't (tested)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "Layer 4/2: a percentage without its base misleads a manager.",
    "how_this_build_will_embody_it": "The cell's title gives 'N of M calls with an outcome'; a dash when none has one."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "Look past the task: production's outcome codes must all be covered by the rule.",
    "how_this_build_will_embody_it": "Production count (phone/video): follow_up 1, none 12 — all covered; unknown codes are null, never counted."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "No external configuration.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "'Did the call reach someone' must be one rule.",
    "how_this_build_will_embody_it": "outcomeConnected in outcomeLabels.ts beside outcomeTone; usage consumes it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "Derived, not stored: a connect rate must come from the record.",
    "how_this_build_will_embody_it": "Computed on read from coaching_sessions.outcome."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "Erasure keeps outcomes as non-personal facts; the rate uses only those.",
    "how_this_build_will_embody_it": "No personal data read."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "Guide, don't overtake: the team's own numbers, not a target.",
    "how_this_build_will_embody_it": "Shown alphabetically like the rest of Team usage; no benchmark."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The mapping follows the outcome names (No contact = not reached); recorded for review."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id was printed at the given line range this session."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Rule, counting, route and render tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-25T22:08:53Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
