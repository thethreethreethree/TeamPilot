# CLOSURE - Vulnerability disclosure

## What is true now

Anyone can report a security or privacy issue at elostate.com/security, without an account; elostate.com/.well-known/
security.txt points researchers there. The page says where a report goes, what is kept (no IP address; a contact only
if given) and what we ask of researchers. The reporter gets a reference. Reports reach only the founders, in a new
"Security reports" inbox in their sidebar, where each is marked Looked at, Fixed, Not an issue or Duplicate with a note;
nothing is edited or deleted. The database change is applied.

## Residual

```json
[
  {"id": "R1-no-alert", "item": "No email or push when a report arrives (F1).", "why_skipped": "No founder alert channel exists outside the Sales Coach bell; email sending is C.A.R.E-only.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-23T07:50:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R2-live-check", "item": "security.txt and /security must be opened on the live site after the push.", "why_skipped": "Not deployed until the founder pushes.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T07:50:00Z", "outcome": "Opened: OPEN.md (after-push check)."},
  {"id": "R3-reporter-erasure", "item": "A reporter who asks to have their name/contact removed has no path (reports are append-only).", "why_skipped": "§3.1.1 covers a company's customers; a reporter is neither. The founders' call how to handle it.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T07:50:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R4-safe-harbour", "item": "The page makes no legal promise to good-faith researchers (safe harbour).", "why_skipped": "Legal wording is the founders' decision, ideally with counsel.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T07:50:00Z", "outcome": "Opened: OPEN.md."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
