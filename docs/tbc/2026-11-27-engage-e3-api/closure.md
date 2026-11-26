# CLOSURE - Engage E3: the public read API

## What is true now

A company admin makes read-only API keys on Protection (shown once; only the hash is kept) and revokes them. Outside
tools read /api/v1/deals, /accounts, /contacts and /calls with `Authorization: Bearer els_…`, a page at a time. Each key
reads its own company only, never a call with an active hide and never a transcript, at most 3 requests a second and
10,000 a day. Every request is recorded and each key shows its last 24 hours.

## Residual

```json
[
  {"id": "R1-personal-keys", "item": "Keys are company-wide (like Gong's API keys); there are no keys that act as one person.", "why_skipped": "Acting as a person needs a JWT secret this server doesn't have (plan E8, §1.5.3).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T21:37:00Z", "outcome": "Recorded in the plan's 00."},
  {"id": "R2-per-second-instances", "item": "The 3-a-second limit is per server instance.", "why_skipped": "An exact cross-instance limit needs a shared store; the daily limit is exact.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T21:37:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
