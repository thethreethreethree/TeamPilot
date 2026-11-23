-- 0320 — expected close date on prospects (2026-11-23; OPEN.md deal-risk "no close-date field, so no forecast by month";
-- gong.io capture M36 forecasting).
--
-- When the rep expects a deal to close is one more FACT about the prospect (§3.1): a 'close_date' event ({ date } —
-- YYYY-MM-DD, or null to clear it), like next_call. The current value is derived — the latest event — in
-- remote_prospects_current, which gains a `close_date` column at the END (create or replace view may only append).
-- A date is not customer words, so legal erasure (0316) needs nothing new. Re-runnable.

alter table public.remote_prospect_events drop constraint if exists remote_prospect_events_kind_check;
alter table public.remote_prospect_events add constraint remote_prospect_events_kind_check
  check (kind in ('name', 'organization', 'stage', 'amount', 'next_call', 'source', 'close_date'));
alter table public.remote_prospect_events drop constraint if exists remote_prospect_events_close_date;
alter table public.remote_prospect_events add constraint remote_prospect_events_close_date
  check (kind <> 'close_date' or jsonb_typeof(value -> 'date') = 'null' or (jsonb_typeof(value -> 'date') = 'string' and (value ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$'));

-- 0313's view, column for column, plus `close_date` last. security_invoker: the caller's RLS applies.
create or replace view public.remote_prospects_current with (security_invoker = true) as
select
  p.id, p.company_id, p.rep_id, p.created_at,
  (select e.value ->> 'text' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'name' order by e.id desc limit 1) as name,
  (select e.value ->> 'text' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'organization' order by e.id desc limit 1) as organization,
  coalesce((select e.value ->> 'status' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'stage' order by e.id desc limit 1), 'open') as status,
  (select e.value ->> 'label' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'stage' order by e.id desc limit 1) as stage_label,
  (select (e.value ->> 'amount')::numeric from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'amount' order by e.id desc limit 1) as amount,
  (select e.value ->> 'date' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'next_call' order by e.id desc limit 1) as next_call_date,
  (select max(s.started_at) from remote_prospect_calls c join coaching_sessions s on s.id = c.session_id where c.prospect_id = p.id) as last_call_at,
  (select count(*) from remote_prospect_calls c where c.prospect_id = p.id) as call_count,
  (select e.value ->> 'text' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'source' order by e.id desc limit 1) as source,
  (select e.value ->> 'date' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'close_date' order by e.id desc limit 1) as close_date
from remote_prospects p;
grant select on public.remote_prospects_current to authenticated, service_role;
