# CLOSURE - Send to CRM fails loud without webhook signing

## What is true now

If webhook signing isn't set up on the server, Send to CRM tells the rep nothing was sent and queues nothing; once it
is, it works as before. /api/health shows `webhooks: true/false`.

## Residual

```json
[
  {"id": "R1-secret", "item": "Whether RSS_WEBHOOK_SIGNING_SECRET is set in production is unverified (no Vercel access here).", "why_skipped": "Founder-owned config (OPEN.md:176).", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-24T20:50:00Z", "outcome": "Check https://elostate.com/api/health → capabilities.webhooks after this deploy."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
