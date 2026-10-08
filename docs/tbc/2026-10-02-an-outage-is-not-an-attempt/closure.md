# CLOSURE - an outage is not an attempt

## What is true now

When the AI provider is down or out of credit, a call's review is left for the next pass instead of being put on
a 14-day hold, and the rep is told the service is unavailable and the recording is saved.

## Residual

```json
[
  {
    "id": "R1-september-markers",
    "item": "Five sessions sit in a 14-day backoff written during the September out-of-credit outage.",
    "why_skipped": "Events are append-only; the markers expire 2026-10-07..09 and the backfill retries them then.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-10-02T04:25:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Residual update (appended 2026-10-08T18:00Z)

- **R1-september-markers: 4 of 5 done, as predicted.** As each 14-day hold expired the backfill reviewed the call:
  823a9095 2026-10-07 12:01Z, 60695cdc and ccdbd9e9 15:01Z, e5a70b9e 21:01Z (coach.dissect_generated). The fifth,
  d32aa211, is held until 2026-10-09 09:00Z and is due on the next backfill after that. OPEN until it lands.
