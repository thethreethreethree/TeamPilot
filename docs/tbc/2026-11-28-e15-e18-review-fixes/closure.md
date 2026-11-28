# CLOSURE - E15–E18 review fixes

## What is true now

A leaked key used from an untrusted address can't lock out the real integration and learns nothing about the key; a
mapped address matches; the library API shows folders as the app does; a deep question skips what it can't open and
says so.

## Residual

```json
[
  {"id": "R1-enrolment-status", "item": "Enrolments in /api/v1/flows carry no status (active, stopped).", "why_skipped": "The state is a replay of engage_activities in the app; an API field can follow if an integration needs it (E16 R2).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-28T04:53:00Z", "outcome": "Recorded."},
  {"id": "R2-other-embedded-v4", "item": "IPv6 forms embedding IPv4 other than ::ffff: (64:ff9b::1.2.3.4) don't parse, so such an entry can't be saved.", "why_skipped": "Refused at save, never silently stored; such entries are rare.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-28T04:53:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
