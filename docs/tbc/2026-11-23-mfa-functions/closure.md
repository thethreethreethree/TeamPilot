# CLOSURE - Multi-factor sign-in for owner-rights functions

## What is true now

Someone who turned on sign-in codes but has only entered their password can no longer reach the database through any
owner-rights function — the 68 callable ones, including every finance action — any more than through a table. The
live API refuses such a call with "Enter the code from your authenticator app to continue." Nobody else is affected:
people without codes, signed-out visitors and the server itself work as before (checked live). A live check fails if
this guard is ever removed. This closes the gap the multi-factor build left open this morning.

## Residual

```json
[
  {"id": "R1-end-to-end", "item": "The refusal has not been exercised with a real held session (F2).", "why_skipped": "Needs TOTP enabled in Supabase and an enrolled account (MFA R1).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T09:05:00Z", "outcome": "Opened: OPEN.md (MFA after-push check)."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
