-- 0390 — the meeting-prep agent trigger (2026-11-27; Engage plan E11; Gong F13.6). Re-runnable.
--
-- agents.trigger kind 'next_call_tomorrow' (no parameters): the nightly job fires it on each open deal whose next call
-- is booked for the company's tomorrow, once per deal and booked date (fire key nextcall:<deal>:<date>, claimed in
-- agent_fires, 0383, before acting) — a call moved to another day is a new date and fires again the night before it.
-- Nothing else changes: the function below is 0389's with one more trigger.

create or replace function public.rss_valid_agent(p_trigger jsonb, p_actions jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(p_trigger) = 'object'
     and (
       (coalesce(p_trigger ->> 'kind', '') = 'deal_stage'
        and (p_trigger ->> 'status' is null or p_trigger ->> 'status' in ('open', 'won', 'lost'))
        and (p_trigger ->> 'label' is null or length(btrim(p_trigger ->> 'label')) between 1 and 60)
        and (p_trigger ? 'status' or p_trigger ? 'label'))
       or
       (coalesce(p_trigger ->> 'kind', '') = 'tracker_heard'
        and coalesce(p_trigger ->> 'tracker_id', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
       or
       (coalesce(p_trigger ->> 'kind', '') = 'close_date_near'
        -- case, not and: SQL doesn't promise to test the pattern before the cast
        and case when coalesce(p_trigger ->> 'days', '') ~ '^[0-9]{1,2}$' then (p_trigger ->> 'days')::int between 1 and 60 else false end)
       or
       -- 0389: nothing but the kind — "quiet" is dealRisk's rule (QUIET_DAYS), not a per-agent number.
       (p_trigger = '{"kind": "deal_gone_quiet"}'::jsonb)
       or
       -- 0390: nothing but the kind — "tomorrow" is the company's day after today (the nightly job's dayIn).
       (p_trigger = '{"kind": "next_call_tomorrow"}'::jsonb))
     and jsonb_typeof(p_actions) = 'array'
     and jsonb_array_length(p_actions) between 1 and 5
     and not exists (
       select 1 from jsonb_array_elements(p_actions) a
        where jsonb_typeof(a) <> 'object'
           or coalesce(a ->> 'kind', '') not in ('brief', 'notify', 'todo', 'webhook')
           or (a ->> 'kind' = 'notify' and coalesce(a ->> 'to', '') not in ('rep', 'owner'))
           or (a ->> 'kind' = 'todo' and (length(btrim(coalesce(a ->> 'title', ''))) not between 1 and 200
                                          or coalesce(a ->> 'due_days', '0') !~ '^[0-9]{1,3}$')))
$$;

