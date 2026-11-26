# CLOSURE - Agent webhook fail loud

## What is true now

An agent's webhook action, while webhook sending is off in production, says the webhook was queued but nothing is
sent, and the run counts as not ok. The nightly job's review fixes (d4dc9ec) are live.

## Residual

```json
[
  {"id": "R1-signing-secret", "item": "Webhook sending is off in production.", "why_skipped": "RSS_WEBHOOK_SIGNING_SECRET is a founder setting (OPEN.md 2026-11-20 / 2026-11-25).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T23:27:00Z", "outcome": "Already recorded."}
]
```

## Un-named reliance

webhooksConfigured stays the one check the sender uses.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
