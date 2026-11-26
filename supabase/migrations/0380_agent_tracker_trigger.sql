-- 0380 — an agent can fire when a tracker is first heard on one of a deal's calls (2026-11-27; Engage plan E5 residual
-- R1; Gong F27.3 "smart tracker signal on a call"). Re-runnable. rss_valid_agent: 0379's rules for 'deal_stage', plus
-- 'tracker_heard' with the tracker's id. The runner checks the tracker is the company's.
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
        and coalesce(p_trigger ->> 'tracker_id', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
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
