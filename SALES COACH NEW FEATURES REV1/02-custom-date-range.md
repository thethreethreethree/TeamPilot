# 02 — Custom date range on Today's Metrics

**What it is.** The Macro door "Today's Metrics" screen could filter by day / week / month / all-time; it now
also has a **Custom** option with two date inputs (from / to), so a rep or manager can see the door KPIs for any
range. 9/2 partner-meeting request #2.

**App work: add a range picker; the existing endpoint gains two params.**

## Web source of truth
- Data: `src/lib/data/doorlog.ts` — `getTodaysMetrics(repId, period, db)`. `period` is now
  `MetricsPeriod | { from: string; to: string }`. For a custom range it filters the KPI rows on
  `date >= from AND date <= to`; the rep_pattern rollup is skipped for custom.
- Endpoint: `GET /api/coach/sales-session/todays-metrics?period=<preset>` OR `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
  Validates the dates match `^\d{4}-\d{2}-\d{2}$` and `from <= to`; returns `period: "custom"` + `range` when a
  range is used. Presets remain `day | week | month | all_time`.
- Web UI: `src/components/sales-coach/doorlog/TodaysMetrics.tsx` — a "Custom" button reveals two date inputs +
  a "pick a range" prompt; a reversed range (from > to) shows a hint instead of firing.

## Data contract
Request: either `period=<preset>` or `from`+`to` (both `YYYY-MM-DD`, from ≤ to).
Response: the same metrics shape as the presets, plus `period` ("custom" when a range) and `range: {from,to}`.

## UI to build (native)
- Add a **Custom** chip beside the day/week/month/all-time chips. Tapping it reveals two native date pickers
  (from, to) and a "Show" action.
- Validate `from <= to` client-side; on reversed, show the hint ("End date can't be before the start") and don't
  fire. Send `from`/`to` as `YYYY-MM-DD` in the device's local sales day.
- Re-fetch the metrics with the range; the KPI numbers + any charts update to that window.

## States
- Prompt ("Pick a range") before both dates are set; reversed-range hint; loading; loaded; error → `—`.
