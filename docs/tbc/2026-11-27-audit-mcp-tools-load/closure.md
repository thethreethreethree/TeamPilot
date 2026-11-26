# CLOSURE - MCP load

## What is true now

An account ask loads only the transcripts it answers from (the newest five calls with no hide). generate_brief over MCP
has 90 seconds. No request sends more than 200 ids.

## Residual

```json
[
  {"id": "R1-very-large-accounts", "item": "An account with more than 200 deals is read through its 200 newest.", "why_skipped": "Far beyond today's accounts; a server-side query would lift it.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T22:59:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

loadCallsByIds keeps loadDealCalls' filters (remote context, sales calls) and order.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
