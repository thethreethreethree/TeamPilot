# CLOSURE - Count every sign-in in team usage

## What is true now

Team usage counts sign-ins from the mobile app and from Google or Microsoft as well as the web form; a web sign-in
recorded by both the form and its session counts once. The count is a lower bound: a session removed at sign-out with
no form record is not seen. The per-person email lookup is gone (one database call). Migration 0327 is applied.

## Residual

```json
[
  {"id": "R1-signed-out-sessions", "item": "A mobile or social sign-in whose session was later signed out is not counted (no other record of it exists).", "why_skipped": "Supabase's auth audit log is empty in this project; recording sign-ins ourselves on every path is its own build.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T22:25:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R2-modules", "item": "Tasks / C.A.R.E / Finance use is still not in the usage view.", "why_skipped": "Part of the same residual; sign-ins first.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T22:25:00Z", "outcome": "Stays in OPEN.md."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
