-- 0330 — "Send to CRM" from a call's Highlights (2026-11-24; General Sales Interface PDF: "generate follow up
-- email/text/API integration (SalesForce/whatever platform the company uses)"; founder picker "Company webhook").
--
-- A new webhook event, call.to_crm: the rep (or their manager) presses "Send to CRM" on a call and the company's own
-- webhook endpoints that take this event receive the call — brief, key points, next steps, follow-up drafts and the
-- linked prospect — to pass on to Salesforce, HubSpot or any CRM (e.g. through Zapier or Make).
-- The queued delivery stores ONLY the call's id; the send job assembles the content at send time (crmExport.ts). So the
-- queue never holds customer words, legal erasure (0285/0316) needs nothing new, and a call erased before sending sends
-- only what is left. Re-runnable.

alter table public.webhook_endpoints drop constraint if exists webhook_endpoints_events_check;
alter table public.webhook_endpoints add constraint webhook_endpoints_events_check
  check (cardinality(events) > 0 and events <@ array['session.scored', 'session.closed', 'deal.closed', 'call.to_crm']);
alter table public.webhook_deliveries drop constraint if exists webhook_deliveries_event_check;
alter table public.webhook_deliveries add constraint webhook_deliveries_event_check
  check (event in ('session.scored', 'session.closed', 'deal.closed', 'ping', 'call.to_crm'));
-- The delivery for a call.to_crm carries ids only, never content.
alter table public.webhook_deliveries drop constraint if exists webhook_deliveries_crm_ids_only;
alter table public.webhook_deliveries add constraint webhook_deliveries_crm_ids_only
  check (event <> 'call.to_crm' or (payload - array['sessionId', 'sentBy']) = '{}'::jsonb);
