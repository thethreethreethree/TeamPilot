-- 0325 — a time on a prospect's next call (2026-11-23; OPEN.md calendar "booked calls show a date only").
--
-- A 'next_call' event's value may now carry an optional "time" ("HH:MM", the rep's local time) beside its date. The
-- calendar shows it and the .ics reminder becomes a timed event. The current time is derived like the date — from the
-- latest next_call event — so setting a new date without a time clears the old time (one fact, one event, §3.1).
-- remote_prospects_current gains `next_call_time` at the END. Re-runnable.

alter table public.remote_prospect_events drop constraint if exists remote_prospect_events_next_call_time;
alter table public.remote_prospect_events add constraint remote_prospect_events_next_call_time
  check (kind <> 'next_call' or value -> 'time' is null or jsonb_typeof(value -> 'time') = 'null'
         or (jsonb_typeof(value -> 'time') = 'string' and (value ->> 'time') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));

-- 0320's view, column for column, plus `next_call_time` last. security_invoker: the caller's RLS applies.
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
  (select e.value ->> 'date' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'close_date' order by e.id desc limit 1) as close_date,
  (select e.value ->> 'time' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'next_call' order by e.id desc limit 1) as next_call_time
from remote_prospects p;
grant select on public.remote_prospects_current to authenticated, service_role;
