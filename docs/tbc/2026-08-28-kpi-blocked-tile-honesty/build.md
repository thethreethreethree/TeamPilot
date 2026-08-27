# BUILD — blocked-tile honesty state

### The blocked render state
- write-path: `page.tsx` — `Metric.blocked?: string`; `renderMetricValue` returns the blocked reason (muted/italic
  + title tooltip) BEFORE the `!apiKey → building…` branch. Sales cycle + Follow-up rate carry
  `blocked: "needs prospect tracking"`.
- read-path: a rep/manager sees "needs prospect tracking" on those two tiles — an honest not-available, not a
  "building…" that would imply the number is coming.

### CSV export honesty
- write-path: the KPI CSV `Value` for a blocked metric is its reason string, not "building".
- read-path: an exported sheet reflects the same truth as the screen.

## Files
- `src/app/dashboard/sales-coach/kpi/page.tsx` — Metric.blocked, renderMetricValue branch, CSV branch, doc comment

## Ripple (§6 item 5)
- Presentation-only, additive optional field. Every other metric (apiKey-wired or genuinely "building") is
  unchanged — the blocked branch only fires for the 2 tiles that set it. No route/compute/schema/data touched.
- The team roster + CSV are unaffected (blocked tiles are /me Layer-1/2 self-view metrics, not team columns).

## Honest limit (verify)
- The rendered "needs prospect tracking" label + styling is founder visual-verify (this client page has no jsdom
  render harness). Typecheck covers the new field + both branches; the behavior is a pure label swap.
