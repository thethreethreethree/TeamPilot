# CLOSURE - Webhook send claims

## What is true now

Two overlapping runs of the webhook sender never send the same attempt twice: each attempt is claimed first, and a run
that loses the claim skips it. The OPEN.md item is closed.

## Residual

```json
[
  {"id": "R1-claim-then-crash", "item": "A run that claims and then dies before sending leaves that attempt unsent for up to 10 minutes; then it is recorded as failed and the next attempt retries.", "why_skipped": "Bounded by STALE_CLAIM_MS and the retry schedule.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T23:30:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

rss_webhook_due counts attempts from webhook_attempts, so a claimed but unsent attempt would be offered again as the same number forever; closeStaleClaim records it as failed after STALE_CLAIM_MS (found while writing this record, fixed in this build).

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
