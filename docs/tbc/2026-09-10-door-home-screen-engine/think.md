---
started_at: 2026-09-10T06:26:00+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — door home screen, Phase 05: the day-target engine

## Why (the record)
Founder dropped a phased build spec (`docs/2ND MAIN PANEL DASKBOARD/home-screen-build/`, 10 files) for a rep
door-tracker home screen. Inspected 100% under the Evidence Protocol → `EVIDENCE.md`; then ran the spec's
Phase 01 (codebase inspection) → `INSPECTION.md`; then the founder answered all Phase-02 decisions (Q1–Q8 +
ratios + greeting + the page-1 duplication), all quoted in `INSPECTION.md`. Chosen build shape:
**phase-by-phase with checkpoints.** This is the first increment: the pure target engine.

## Understanding
`05-target-engine.md`: "the only real logic in the build; everything else is display." It must be a PURE
function (no DB) so the arithmetic is testable without a database. The decisions fix its shape:
- Works a manager-set daily SALES goal (Q1) back through TWO 30-day ratios (Q4, ratios decision): close =
  sales÷presentations, contact = presentations÷doors → `doors = goal ÷ close ÷ contact`, round UP each step.
- New/thin-history rep → a fixed STARTER (Q4): implemented as starter RATIOS (the mockup's 1/9, 1/4.4) so a
  goal of 2 naturally yields the mockup's 18 presentations / 80 doors, and all three targets exist (Q2).
- Never divide by zero: a null/zero/absurd ratio, or an unqualified rep, falls back to the starter (this is
  the case `05` says to "get right" — zero sales makes `goal ÷ 0` infinite).
- Floor/ceiling on the door number, overshoot clamps the ring at full (documented defaults, John to veto).
- A non-positive goal → all-zero targets (no fabricated number).

## Scope of THIS phase
`src/lib/coach/doorlog/dayTarget.ts` — `calculateDayTarget(input)→{doors,presentations,sold,usedStarter}` +
`dialFill(count,target)`, plus its tests. NO database, NO migration, NO UI — those are later increments
(Phase 04 data model + read layer next, then 06/07/08 UI). Nothing wired to a caller yet by design.

## Ripple (§1.5)
- Pure module, zero imports of app state → cannot affect anything until a caller is added in a later phase.
- Reuses no existing engine (there was none); the ratios it consumes will come from the existing
  `door_knocks`/`pitches` data (INSPECTION.md Q2), computed in the Phase-04 read layer, not here.

## Session-Reads (A22)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-10T06:26:10+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The spec was inspected 100% and the codebase mapped before any code; the engine's inputs come from that inspection, not assumption." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-44", "read_at": "2026-09-10T06:26:10+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Both governing docs are in-tree; hashes pinned above." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-10T06:26:10+08:00",
    "why_it_governs": "Layer-2 effectivity — the screen's claim is the numbers are right.",
    "how_this_build_will_embody_it": "The engine is verified against the worked example (80, not 79) and every enumerated edge case, not just 'renders'." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-10T06:26:10+08:00",
    "why_it_governs": "THINK first, then confirm.",
    "how_this_build_will_embody_it": "The zero-sales divide-by-zero was designed for up front (starter fallback), per 05's explicit warning." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "288-296", "read_at": "2026-09-10T06:26:10+08:00",
    "why_it_governs": "Trace what else a change touches before committing it.",
    "how_this_build_will_embody_it": "The ripple section shows the engine is a pure module with no caller yet, so it cannot affect the live app, and its ratio inputs come from existing door_knocks/pitches." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-380", "read_at": "2026-09-10T06:26:10+08:00",
    "why_it_governs": "The System must never fabricate a number it cannot honestly derive; an honest empty state beats an invented one.",
    "how_this_build_will_embody_it": "A non-positive goal returns all-zero targets (the empty/starter state), and a zero/absent ratio falls back to the starter — never a made-up or infinite door number." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-448", "read_at": "2026-09-10T06:26:10+08:00",
    "why_it_governs": "Founder decisions via picker.",
    "how_this_build_will_embody_it": "Every Q1–Q8 decision + ratios + greeting + duplication + build shape went to John as pickers; recorded in INSPECTION.md." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-10T06:26:10+08:00",
    "why_it_governs": "The governing methodology must live in the working tree.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md are in this tree; the cited ranges were opened this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-604", "read_at": "2026-09-10T06:26:10+08:00",
    "why_it_governs": "Cited clauses read in-session.",
    "how_this_build_will_embody_it": "Each entry carries an in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-10T06:26:10+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "The worked example + edge cases are pinned by tests that fail if the arithmetic regresses." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1008", "read_at": "2026-09-10T06:26:10+08:00",
    "why_it_governs": "'Verified' names the command actually run.",
    "how_this_build_will_embody_it": "check.md pastes the whole npm run check output + exit code and the mutation result." }
]
```
