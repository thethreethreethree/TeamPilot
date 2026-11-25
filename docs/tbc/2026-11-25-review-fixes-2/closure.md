# CLOSURE - Fixes from the second review

## What is true now

The six findings are fixed. /status no longer claims more than it checked; the CSV can't set a role the Team page
refuses and can give a role to someone without one; KPI labels and the growth summary name the window of the numbers
shown, and only the latest request can land; the coaching table shows every manager with a computed number.

## Residual

```json
[
  {"id": "R1-kpi-page-test", "item": "The KPI page's latest-request guard and labels have no render test.", "why_skipped": "The page has no render test harness yet; the route and the period helper are tested.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T01:40:00Z", "outcome": "Accepted."},
  {"id": "R2-live-ai-probe", "item": "/status can't tell an AI outage from working; it says 'Switched on'.", "why_skipped": "A live provider call per page view costs money and adds latency.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-25T01:40:00Z", "outcome": "Accepted; worded honestly."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
