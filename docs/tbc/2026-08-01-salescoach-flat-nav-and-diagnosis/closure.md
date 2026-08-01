# CLOSURE — Sales Coach flat nav + diagnosis

## What shipped
- Flat, mode-universal Sales Coach sidebar (founder's July-28 order) — the first concrete fix for the
  mode-specific cause of "edits don't stick".
- The root-cause diagnosis doc: the edits WERE live; the origin is mode-specific edits + stale PWA/host +
  duplicated tooltip copy.

## Un-named reliance (not self-evident)
- A single headerless `NavSection` renders as a flat list ONLY because the render loop skips the header `<p>`
  and the numbering when `section.header` is undefined — verified by reading the loop, not assumed.
- `filterManagerNavSections` filters within each section, so one flat section still hides manager items — the
  gating did not depend on the grouping.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "Team Chat + KPI Analytics were KEPT in the flat nav though the July-28 list omits them (they were built after that list).", "why_skipped": "Dropping real, shipped features silently is worse than a nav that has two extra items; flagged to the founder to confirm.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-01T09:00:00Z", "outcome": "OPENED — founder to confirm keep/drop." },
  { "id": "RES-02", "item": "Duplicated tooltip copy (LearningHint why=) still holds some removed sentences (e.g. earpiece 'cue plays to your device').", "why_skipped": "Hidden until a user opens the hint; the visible text is already clean. Swept in a follow-up copy pass.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-01T09:00:00Z", "outcome": "OPENED — next phase sweeps tooltip twins." }
]
```

## Verification
Typecheck exit 0; managerNav 6/6 (see check.md). Full `npm run check` is the CI gate.
