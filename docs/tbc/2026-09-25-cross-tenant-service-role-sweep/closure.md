# CLOSURE — the service-role routes, query by query

## What is true now

One cross-tenant read is closed and pinned by a test whose mock honours filters. One cross-tenant
write is found, evidenced, and with the founder — it reverses a recorded ruling of his.

## The finding

The calibration leak passed its tests because the mock's `.eq` returned the row whatever you
filtered on. **A mock that ignores filters cannot test a filter**, and every tenancy guarantee on a
service-role route IS a filter. Same shape as today's other vacuous checks, in the one place where
vacuous is a security property.

## Residual

```json
[
  {
    "id": "R1-add-member-cross-company",
    "item": "team/add-member existing-mode moves a user from any company into the caller's.",
    "why_skipped": "Reverses a recorded founder ruling; asked in a picker.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-25T12:30:00Z",
    "outcome": "OPEN pending the founder."
  },
  {
    "id": "R2-four-route-groups-unread",
    "item": "team-analytics, list, care/inbound/email, the three crons.",
    "why_skipped": "Stopped to surface R1.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T12:30:00Z",
    "outcome": "OPEN. Next."
  },
  {
    "id": "R3-other-route-tests-with-filter-blind-mocks",
    "item": "The calibration builder pattern (every method returns the builder, resolves one fixed row) is likely copied across other service-role route tests.",
    "why_skipped": "Not yet swept.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-25T12:30:00Z",
    "outcome": "OPEN. Any tenancy claim resting on such a test is unproven."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
