# CLOSURE - Engage E1: flows, enrolments, today's steps

## What is true now

Remote Sales has Engage. Managers make company flows and anyone makes their own. A flow is steps (email, call, task),
each after a delay in hours or business days, with {first_name}, {company} and {deal} filled in. On a deal, a contact
gets an email and a phone and can be added to a flow. Engage → Today lists every due step across the rep's deals (a
manager can see the team). An email opens in the rep's own mail app. A call dials from their phone and needs an outcome
from Gong's list. "Meeting booked" or "They replied" ends the flow. "Asked not to be contacted" removes them and blocks
every future flow. Nothing is sent from the app.

## Residual

```json
[
  {"id": "R1-auto-email", "item": "Email steps are sent by the rep from their own mail app; there's no automatic sending, open or reply tracking.", "why_skipped": "Needs Postmark configured (unset in production) and legal opt-out wording (plan E1).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T21:48:00Z", "outcome": "Recorded in the plan's 00."},
  {"id": "R2-dialer", "item": "Calls dial from the rep's phone; there's no in-app dialer or recording of those calls.", "why_skipped": "Needs a Twilio account and per-region recording consent (plan E4).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T21:48:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
