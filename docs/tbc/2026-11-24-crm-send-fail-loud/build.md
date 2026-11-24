# BUILD - Send to CRM fails loud without webhook signing

No migration. Depends on RSS_WEBHOOK_SIGNING_SECRET (existing; founder setup, OPEN.md:176).

### A rep sends a call to the CRM while signing isn't set up
write-path: Send to CRM → POST /api/coach/remote/[id]/send-to-crm → webhooksConfigured() false → 503, nothing queued.
read-path: the rep reads "Sending to a CRM isn't switched on for ELOSTATE yet — a setup step on our side. Nothing was
sent; copy the follow-up for now." under the button (it stays pressable).

### The founder checks whether webhooks can send
write-path: none.
read-path: GET https://elostate.com/api/health → capabilities.webhooks true/false.
