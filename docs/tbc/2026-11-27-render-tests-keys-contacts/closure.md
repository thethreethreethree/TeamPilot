# CLOSURE - Keys and contacts

## What is true now

Revoking an API key asks first. Saving a contact's email or phone re-reads the deal without writing a deal event. Both
screens have render tests.

## Residual

```json
[
  {"id": "R1-past-junk-events", "item": "Earlier email/phone saves may have written duplicate deal_contacts rows.", "why_skipped": "Append-only; they replay to the same role, so the deal is unchanged.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T00:01:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

The prospects route keeps reading contacts from deal_contacts_current (the latest role per contact).

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
