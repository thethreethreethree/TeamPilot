# CLOSURE - Fixes from the review of the revenue and Engage builds

## What is true now

A brief or playbook AI read quoting a call hidden from the reader isn't served to them (and never over MCP if any hide
is active on it). A tracker agent fires once per call and tracker, never on a call its owner can't hear. Stage agents
fire only on a real stage change. Accounts follow a deal's current account; contacts are reached through the deals and
calls a person can see. Forecast notes and deal names in agent payloads are refused. Forecast reads every row.
'Ghosted' needs seven days.

## Residual

```json
[
  {"id": "R1-contacts-on-unshared-accounts", "item": "A contact added on an account with no deal is now seen only by whoever added it.", "why_skipped": "That is the fix: the account branch showed other reps' contacts.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T22:40:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

The hidden checks rely on rss_call_hidden_for (0337) and rss_hidden_calls_for (0345) staying the authority.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
