# CLOSURE — knowledge panel local date

## What shipped
The AdaptiveKnowledgePanel version-date label now renders the viewer's local `YYYY-MM-DD`
(`toLocaleDateString("en-CA")`) instead of the UTC calendar date. An evening edit west of UTC no longer
displays a day ahead. A small consistency + correctness fix that brings this label in line with the rest of
the UI's date formatting.

## Un-named reliance (not self-evident)
- **`en-CA` is chosen for its FORMAT, not the locale.** en-CA's `toLocaleDateString` output is `YYYY-MM-DD`,
  which preserves the fixed-width `font-mono` column. If a future edit "simplifies" it to a bare
  `toLocaleDateString()`, the format becomes locale-dependent (`M/D/YYYY` in en-US) and the mono column
  ragged — the `en-CA` argument is load-bearing for the layout, not incidental.
- **This was a DISPLAY-only bug.** The stored `createdAt` timestamp was always correct; only its rendering was
  UTC. No data migration or backfill is implied.

## Audit result (the larger genuine finding)
The UTC-day sweep confirmed the class is well-defended across the codebase: server-side date-keys that use UTC
do so deliberately (DB session is UTC — checked live, documented, downstream-validated), and client displays already
use local formatting. This lone client outlier was the only real instance.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No DOM/visual test that toLocaleDateString('en-CA') renders a local YYYY-MM-DD (vitest env is node/no-DOM, not the house style for component render tests).", "why_skipped": "en-CA's YYYY-MM-DD format is well-defined and used elsewhere in the UI; display-only change; founder verifies live.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-02T01:12:00Z", "outcome": "OPENED — the sibling convention (FileCard/LiveCoachingPanel) uses toLocaleDateString and en-CA yields YYYY-MM-DD; format + zone both correct." },
  { "id": "RES-02", "item": "Did not audit non-.tsx date rendering (e.g., server-composed email/report strings) for the same UTC-slice pattern.", "why_skipped": "The sweep scoped to client components (the class instance was there); server date-keys were separately checked UTC-correct in check.md.", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": null }
]
```
