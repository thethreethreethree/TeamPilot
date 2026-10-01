# CLOSURE - a pitch is not six hours long

## What is true now

A pitch from a session that sat open until the auto-close job ended it is stored with no length, not six hours,
and the Recordings tab shows nothing rather than "6:15:53". Every surface that shows how long a call was now
uses one rule, and a new copy of the subtraction fails the invariant audit.

## The finding

The rule had been extracted to one place precisely to stop copies, and a fourth copy appeared anyway, without
the one term that mattered. Extraction without a gate is a promise.

## Residual

```json
[
  {
    "id": "R1-autoclose-ended-at",
    "item": "auto-close-stale-cron's ended_at is the close time, hours after the conversation; any future reader that bypasses conversationDurationSeconds would read idle hours.",
    "why_skipped": "INVARIANT 31 blocks the subtraction; changing what the trigger stamps needs a migration and a founder go-ahead.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-10-01T05:10:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
