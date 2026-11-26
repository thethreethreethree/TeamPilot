# CLOSURE - Removing people with the team CSV

## What is true now

An admin can remove people with the team CSV (action: remove). The preview names each removal and how many people
report to them; importing asks once. Removals go through the Team page's own rules — never yourself, never the last
active admin — and their calls and history stay. Both last-admin checks now count only active admins.

Un-named reliance: people who reported to a removed person keep that manager link until it's changed on the Team page.

## Residual

```json
[
  {"id": "R1-orphaned-reports", "item": "Removing a manager leaves their reports pointing at them.", "why_skipped": "Same as removing one person on the Team page; the preview says how many and to reassign them.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T10:22:38Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
