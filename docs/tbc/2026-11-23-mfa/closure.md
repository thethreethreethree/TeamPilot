# CLOSURE - Multi-factor sign-in

## What is true now

Anyone can turn on sign-in codes in Settings: they scan a QR code with an authenticator app and type a code to confirm.
From then on, signing in asks for a 6-digit code after the password, and until it is entered the account can open no
page, call no API route and read or write no table or file — the database itself refuses (0309, applied: 190 tables and
storage). A person can remove their own authenticator once signed in with a code; a company admin can reset a member's
after a lost phone. Each step is in the audit log.

## Residual

```json
[
  {"id": "R1-totp-config", "item": "TOTP MFA must be enabled in the Supabase project (Auth → MFA); the settings endpoint does not expose it, so no enrolment has been run against production.", "why_skipped": "External config (§1.5.3): enrolment fails loudly with the provider's reason if it is off; the first real enrolment proves it.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-22T23:55:00Z", "outcome": "Opened: OPEN.md; APPLY-RUNBOOK after-push check."},
  {"id": "R2-definer-functions", "item": "128 SECURITY DEFINER functions callable by authenticated are outside the database rule (F1).", "why_skipped": "Each needs reading to decide whether it reads/writes customer data; a blanket change risks breaking policy helpers.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-22T23:55:00Z", "outcome": "Opened: OPEN.md — next build."},
  {"id": "R3-mobile-extension", "item": "The mobile app and Chrome extension cannot ask for a code; with codes on they refuse to work for that person (F2).", "why_skipped": "Each client needs its own code step.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-22T23:55:00Z", "outcome": "Opened: OPEN.md; stated on the Settings panel."},
  {"id": "R4-company-policy", "item": "A company-wide 'everyone must use codes' setting is not built.", "why_skipped": "Per-person first; the policy is its own build.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-22T23:55:00Z", "outcome": "Opened: OPEN.md."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
