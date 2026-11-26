# CLOSURE - Extension MFA handoff

## What is true now

Connecting the Chrome extension with sign-in codes on asks for the code on the web first, then hands the extension a
session that has passed it. The mobile app still can't ask for a code (its source isn't in this repo).

## Residual

```json
[
  {"id": "R1-verify-live", "item": "End to end with a real authenticator: connect the extension, enter the code, use the extension past an hour (a refresh).", "why_skipped": "TOTP must be switched on in Supabase first (OPEN.md BLOCKING SETUP).", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-26T23:43:00Z", "outcome": "Added to OPEN.md."},
  {"id": "R2-mobile", "item": "The mobile app has no code step.", "why_skipped": "Not in this repo.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T23:43:00Z", "outcome": "OPEN.md item stays open for the mobile half."}
]
```

## Un-named reliance

The extension keeps taking its session from /extension/connect; resolveApiAuth/extensionAuth keep refusing a session that owes its code.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
