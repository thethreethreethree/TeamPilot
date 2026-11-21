# CLOSURE - RSS Phase 9

## What is true now

A company admin can add an https address on Settings → Protection and choose to be told when a call is scored, ends,
or closes a deal; each request is signed with that address's own secret, retried with backoff, and logged, and a test
can be sent from the screen. An admin can add a team from a CSV on the Team page: they see what each row will do,
then new people are invited exactly as if invited one by one, and managers are set for people already on the team.
Google and Microsoft sign-in are built and hidden until set up.

## Residual

```json
[
  {"id": "R1-webhook-secret", "item": "RSS_WEBHOOK_SIGNING_SECRET is not set in Vercel, so nothing is sent yet.", "why_skipped": "External config (§1.5.3): the operator sets it; the cron answers 503 and the screen says 'not configured' until then.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-20T21:50:00Z", "outcome": "Opened: OPEN.md blocking setup step; .env.example documents it."},
  {"id": "R2-oauth-config", "item": "Google and Microsoft providers are not configured in Supabase; the buttons are hidden.", "why_skipped": "External config: provider apps, secrets and allowlist live outside the repo.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-20T21:50:00Z", "outcome": "Opened: docs/AUTH-REDIRECTS.md 'OAuth providers' (blocking, with verification steps); OPEN.md."},
  {"id": "R3-manager-on-invite", "item": "A manager named in the CSV for someone being invited is not applied when they join; the admin sets it on the Team page.", "why_skipped": "An invitation has no person yet; applying it at accept needs a column on team_invitations and a change to the accept path.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-20T21:50:00Z", "outcome": "Opened: OPEN.md; the import says so per row."},
  {"id": "R4-dns-ssrf", "item": "A webhook hostname that RESOLVES to a private address is not refused (literal private IPs and local names are).", "why_skipped": "Needs a DNS check at send time; redirects are already not followed.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-20T21:50:00Z", "outcome": "Opened: OPEN.md."},
  {"id": "R5-db", "item": "0286 not applied; the 'Looked at' against a real receiver not done.", "why_skipped": "Supabase suspended.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-20T21:50:00Z", "outcome": "Opened: OPEN.md."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
