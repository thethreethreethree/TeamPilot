---
title: Schedule Management System — VA presence-grid import (Phase 5 follow-up)
build_plan: ScheduleManagementSystem.md
phase: 5 of 8 (import — the founder's ACTUAL file format)
started_at: 2026-08-19T15:00:00Z
manifest_entries: 12
---

# VA presence-grid import

Founder decision (2026-08-19 picker): **"Full: .docx + .pdf + VA parser."** The Phase-5 CSV import handles a
staff × date shift-code grid, but the founder's real samples (VA_Weekly_Schedule.docx / VA_Weekly_Color_Grid.pdf)
are a **time-block × staff "On Duty" presence grid** — a different data model. Finding + options doc:
`docs/audits/2026-08-19-schedule-import-format-gap.md`.

## Step 2 — Session-read manifest (A22 / A35)
```json
[
  { "id": "§0",     "read_at": "2026-08-19T15:30:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",  "why_it_governs": "Understanding precedes solving — I extracted BOTH sample files' actual formats before writing a parser, rather than assuming the CSV shape fit.", "how_this_build_will_embody_it": "The parser is built from the verified real format (time-block×staff On-Duty), proven by an integration test over the founder's actual grid." },
  { "id": "§0.1",   "read_at": "2026-08-19T15:30:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",  "why_it_governs": "Governing methodology in-tree + read this session.", "how_this_build_will_embody_it": "CLAUDE.md in context; ThinkerThinker.md A-clauses re-read this session (below)." },
  { "id": "§1.5.1", "read_at": "2026-08-19T15:30:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer / layer-2 effectivity — the whole finding is that the import failed layer 2 (didn't work on the founder's REAL input); this build fixes that.", "how_this_build_will_embody_it": "The acceptance test runs the founder's actual VA grid end-to-end, not a synthetic fixture." },
  { "id": "§1.5.2", "read_at": "2026-08-19T15:30:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK about failure before coding — the midnight-wrap coalescing bug was caught by reasoning about the real grid's 5AM→5AM cycle before the test ran.", "how_this_build_will_embody_it": "Hypotheses (ambiguous shorthand meridiem, cross-midnight coalescing) drove the parser design + are locked by tests." },
  { "id": "§2",     "read_at": "2026-08-19T15:30:00Z", "source_file": "CLAUDE.md", "line_range": "232-260", "why_it_governs": "Interrogate locked doors — when the .pdf plain-text extraction looked impossible (columns collapsed), ask WHY before declaring it unsupported.", "how_this_build_will_embody_it": "I interrogated the constraint: unpdf's positioned items (extractTextItems) recover the columns by x, so .pdf was incidental-blocked, not truly blocked — built the reliable path instead of flagging a dead end." },
  { "id": "§3.3",   "read_at": "2026-08-19T15:30:00Z", "source_file": "CLAUDE.md", "line_range": "310-330", "why_it_governs": "Guide, don't overtake — the format decision (recurring template? which formats in scope?) is the founder's, not mine to assume.", "how_this_build_will_embody_it": "I surfaced 3 numbered options + a recommendation via a picker and built only what the founder chose." },
  { "id": "§3.4",   "read_at": "2026-08-19T15:30:00Z", "source_file": "CLAUDE.md", "line_range": "332-343", "why_it_governs": "Honesty — an unparseable time-block must be surfaced, never silently mis-timed or dropped.", "how_this_build_will_embody_it": "parseVaGrid collects unparsedBlocks; a bad label with On-Duty marks is reported, not swallowed (tested)." },
  { "id": "§6",     "read_at": "2026-08-19T15:30:00Z", "source_file": "CLAUDE.md", "line_range": "402-440", "why_it_governs": "Checklist — trace what this composes with; the parser must converge on the existing import pipeline, not a parallel one.", "how_this_build_will_embody_it": "The parser's output is designed to feed the same planImport → apply_schedule_import commit path (next unit); no duplicate writer." },
  { "id": "A19",    "read_at": "2026-08-19T15:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "55-59", "why_it_governs": "Methodology in the working tree.", "how_this_build_will_embody_it": "ThinkerThinker.md opened + read this session." },
  { "id": "A22",    "read_at": "2026-08-19T15:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "55-59", "why_it_governs": "Citations require an actual session read, not cached labels.", "how_this_build_will_embody_it": "This manifest, with the A-clause index re-read at the cited lines this session." },
  { "id": "A30",    "read_at": "2026-08-19T15:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "90-96", "why_it_governs": "A lesson in prose returns — the parser's correctness must be encoded in a gate that fails without me.", "how_this_build_will_embody_it": "10 tests lock parseTimeBlock (both notations + ambiguity), coalesceRanges (cross-midnight), and the real-data grid." },
  { "id": "A38",    "read_at": "2026-08-19T15:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "90-96", "why_it_governs": "'Verified' names the command.", "how_this_build_will_embody_it": "check.md pastes the vitest + npm run check result with the exit code." }
]
```

## Step 3 — Hypotheses (§1.5.2)
- **H-a ambiguous shorthand meridiem.** ".pdf" writes "10-12 PM" meaning 10 AM–12 PM. Naive inherit-from-end gives 10 PM. Mitigation: inherit end meridiem, flip to the other half if that makes the block non-forward. Locked by a parseTimeBlock test. The ".docx" (explicit both sides) is the canonical source.
- **H-b cross-midnight coalescing.** The grid's day cycles 5AM→next-day 5AM, so "11 PM-2 AM" + "2-3 AM" is ONE run. Sorting by absolute clock splits it. Mitigation: coalesce in row/cycle order, advancing a day when the clock wraps. Locked by the Nikko real-data assertion (23:00–03:00).
- **H-c silent drop of an unreadable block.** Mitigation: unparsedBlocks surfaced (3.4), tested.

## Step 4 — Spec fidelity
Founder chose the FULL option: .docx + .pdf reading AND the VA-shape parser. This unit is the file-format-INDEPENDENT
CORE (the hard, testable part): parse time-blocks + coalesce On-Duty runs → per-staff shifts as a recurring weekday
template. The .docx table extractor, the .pdf extractor, the recurring→dated resolution, and the pipeline/UI wiring
are the remaining units (residuals below), each converging on this core + the existing commit path.

## Step 5 — Four-layer pre-walk
1 (structure): a pure module beside gridParser/csvGrid; no dep; output shaped to reuse the existing import commit path.
2 (effectivity): proven against the founder's ACTUAL grid (the whole point of the finding). 3 (composition): converges
on planImport → apply_schedule_import (next unit), not a parallel writer. 4 (surface): the upload UI gains a VA path
(later unit). **SHIPPABLE foundation** — the parse is correct + locked now; extraction/wiring build on it.
