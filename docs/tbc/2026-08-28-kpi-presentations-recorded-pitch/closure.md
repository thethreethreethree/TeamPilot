# CLOSURE — KPI accuracy: presentations = recorded pitches (Task 3, part 1)

## What shipped
The KPI "presentations" (and the Macro "conversations" trio) now count RECORDED pitches (`pitches` rows, unique per
door) instead of the old `doors_knocked − no_answer` proxy. For Moses this corrects 46 → 41 (the founder-confirmed
number); it flows to the Coach Assessment card, the Macro dashboard bubble, the Door Log strip, and the rep
self-view — every surface reads the one returned value (§2.2, no re-derivation). Both counts throw on a read error
so a failure degrades visibly, never to a false 0 (§3.4 / INV22).

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). The accuracy itself is verified LIVE against prod (Moses 46→41 = confirmed;
period embedded-inner head:count works).

## The un-named reliance
- **The counts are verified live, not unit-tested** — `getAllTimeKpi` / `getTodaysMetrics` are IO functions with no
  existing mock harness; a DB row-count is only meaningful against real data. If a future refactor re-introduces
  `knocked − no_answer`, no unit test would catch it (the live probe would). Documented, not hidden.
- **Data integrity was audited and is clean** — `rep_kpi_daily` matches raw `door_knocks`, zero duplicate
  `client_knock_id`. The source was never the problem; only the presentations definition was.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Task 3 'build features' half is NOT started — the founder said the KPI page has 'a lot of features yet to be built'. Which features is a founder decision (surfaced next via picker).",
    "why_skipped": "Accuracy (the confirmed defect) was part 1 and is done. The feature set is open-ended and the founder's to direct.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-28T06:20:00+08:00",
    "outcome": "OPEN — bring the founder a picker of candidate KPI features."
  },
  {
    "id": "R2",
    "item": "The /kpi 'Conversion rate = sold ÷ opportunities' (coaching-session system, compute.ts) was NOT re-audited — a separate data source from door presentations.",
    "why_skipped": "The founder's flagged inaccuracy was the door card (presentations). The session conversion is correct by its own definition; auditing it is a separate pass if wanted.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T06:20:00+08:00",
    "outcome": "OPEN — offer a conversion-denominator audit as a follow-up."
  }
]
```
