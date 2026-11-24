# REMEDIATE - Send a call to the company's CRM

### F1 - a queued CRM delivery could hold a second copy of a customer's words
Payload is ids only; content is built at send time.
gate-or-promise: gate (constraint webhook_deliveries_crm_ids_only; replay0330 shows a content payload refused)
