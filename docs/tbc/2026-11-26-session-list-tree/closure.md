# CLOSURE - The session list follows the reporting tree

## What is true now

A manager's session history shows only reps in their reporting tree, as everywhere else, and keeps the newest 300 of
those; calibration and team usage consider every scored call and person before narrowing to the manager's team.

Un-named reliance: a company with more than 10,000 sessions outside a manager's tree before their 300th visible one
shows fewer than 300 and says it stopped.

## Residual

```json
[
  {"id": "R1-tree-gate", "item": "No audit refuses a service-role read of a rep's calls that doesn't ask the reporting tree (invariant 43 checks hides only).", "why_skipped": "Needs a reasoned allowlist like invariant 43's; a large sweep of its own.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-26T01:40:00Z", "outcome": "Recorded; next audit."},
  {"id": "R2-askcoach", "item": "Ask Coach's chat list reads the person's 20 newest chats on a call before the hide filter.", "why_skipped": "The person's own chats about one call; nothing of another team's can crowd it.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T01:40:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
