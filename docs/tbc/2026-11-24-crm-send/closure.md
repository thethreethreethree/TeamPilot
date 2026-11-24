# CLOSURE - Send a call to the company's CRM

## What is true now

On a call's Highlights in Macro Mode, under the follow-up drafts, "Send to CRM" sends the call's brief, key points,
next steps, the latest email and text drafts, the linked prospect and a link back to the call to every webhook the
company subscribed to "A call is sent to your CRM". With none, the rep reads that an admin adds one in Remote Sales →
Protection → Webhooks. The queue never holds the call's words.

## Residual

```json
[
  {"id": "R1-admin-setup", "item": "No company has an endpoint subscribed to call.to_crm yet; until an admin adds one (and wires it into their CRM, e.g. via its automation or Zapier), reps get the 409 message.", "why_skipped": "External config owned by each customer (§1.5.3); it fails loud, never silently.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-24T01:10:00Z", "outcome": "Accepted; listed in OPEN.md for the founder."},
  {"id": "R2-native-connectors", "item": "No built-in Salesforce/HubSpot connector (OAuth, field mapping).", "why_skipped": "Founder picker chose 'Company webhook'.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-24T01:10:00Z", "outcome": "Accepted; revisit if customers ask."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
