# BUILD - Send a call to the company's CRM

Migration 0330_webhook_call_to_crm.sql (applied; DB at 0330). No env keys (the cron uses NEXT_PUBLIC_SITE_URL for the
call link, falling back to https://elostate.com).

### A rep sends a call to the CRM
write-path: Macro Highlights → Follow up → "Send to CRM" → POST /api/coach/remote/[id]/send-to-crm → getSession
(caller's client) + isSalesCall + not live → rss_webhook_enqueue(company, 'call.to_crm', {sessionId, sentBy}) → one
webhook_deliveries row per subscribed endpoint (ids only) + audit session.export {to: "crm"}.
read-path: send cron → buildCrmCall(company, sessionId) → signed POST to the company's endpoint {call, brief, followUp,
prospect}; the rep reads "Sent to your CRM…" and the button reads "Sent to CRM"; an admin reads the delivery in
Protection → Webhooks under "A call is sent to your CRM (from Highlights)".

### An admin subscribes an endpoint
write-path: Protection → Webhooks → pick "A call is sent to your CRM (from Highlights)" → webhook_endpoints.events
includes 'call.to_crm' (0330 check).
read-path: the endpoint's event list in the same panel; the rep's send no longer answers 409.
