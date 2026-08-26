# BUILD — Review fixes (scenario loop, material retry, brief label)

### scenario auto-fetch latch (HIGH)
- write-path: `roleplay/page.tsx` — `scenarioAttemptedRef` (keyed on focus); the auto-fetch effect fires once per focus
  and no longer re-triggers when a null/error result flips `scenarioLoading` back. "New scenario" still refetches.
- read-path: a failed generation settles to the plain focus seed instead of a request storm + stuck spinner.

### material retry (MEDIUM)
- write-path: `training/page.tsx` — `toggleLearn` refetches on undefined OR null (retry after a failed load); a loaded
  guide is kept.
- read-path: the "try again" the error text promises now works on reopen.

### brief window label (MEDIUM)
- write-path: `TeamTrainingBriefPanel.tsx` — the intro describes the BUILD action for the selected period; a separate
  "Showing {brief.periodLabel}" line labels the displayed brief by its own window.
- read-path: toggling Day/Week without rebuilding no longer mislabels the shown brief.

## Files
- `src/app/dashboard/sales-coach/roleplay/page.tsx` — scenario attempt-latch.
- `src/app/dashboard/sales-coach/training/page.tsx` — material retry condition.
- `src/components/sales-coach/TeamTrainingBriefPanel.tsx` — displayed-brief window label.

## Ripple (§6 item 5)
Three isolated UI-logic fixes. No route/engine/schema change; the LLM routes, the scored review, and the analytics are
unchanged. Typecheck clean.

## Honest limit
These are React effect/render fixes with no pure-function seam to unit-test; they're checked by reasoning + typecheck
+ the reviews that found them. A render-test harness for these pages is a later hardening.
