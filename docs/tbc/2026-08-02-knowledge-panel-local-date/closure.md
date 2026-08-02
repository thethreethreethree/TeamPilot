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
do so deliberately (DB-session-UTC-verified, documented, downstream-validated), and client displays already
use local formatting. This lone client outlier was the only real instance.
