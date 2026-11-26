# CLOSURE - Revenue Phase 3a: Gong's deal warnings in dealRisk

## What is true now

An open deal now also warns when the customer has stopped speaking on its calls (7 days), when it has fewer than two
contacts after two weeks, when no director, VP or C-level contact has been active within 30 days of close, when price
hasn't come up within 30 days of close, and when it has sat in a stage past that stage's limit. Two reasons make it at
risk, as before. The facts are read as the viewer, so a hidden call's words never count.

Un-named reliance: the pricing words are English (the transcripts are English, RSS D17).

## Residual

```json
[
  {"id": "R1-warning-history", "item": "Warnings are computed live; there is no daily record of which deals had which warning, so Deal drivers (F20.11) can only show 'now', not 30 or 90 days.", "why_skipped": "A daily snapshot needs a cron, and CRON_SECRET is unset in Vercel (BUILD-STATE carry-over, §1.5.3).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T20:57:00Z", "outcome": "Recorded; Phase 4 builds drivers on the live verdict and says so."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
