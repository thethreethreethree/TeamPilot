-- 0392 — fill the playbook from each call (2026-11-27; Engage plan E12; Gong F27.10 AI data extractor). Re-runnable.
--
--   · agents.trigger kind 'call_linked' (no parameters): fired right after a call is linked to a deal (the deal route's
--     "link"), once per agent, deal and call (fire key call:<deal>:<call>, claimed in agent_fires, 0383). A call hidden
--     from the agent's owner never fires it (0337's rule, as the tracker trigger).
--   · action kind 'playbook': run the AI Deal Reviewer (0373) over the deal's calls the owner may hear — evidence-only,
--     never over a person's note; its reads are deal_element_notes 'ai_suggest' rows, erased with the calls (0373).
-- The function below is 0390's with the new trigger and action.

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
       (p_trigger = '{"kind": "next_call_tomorrow"}'::jsonb)
       or
       -- 0392: a call is added to a deal. Nothing but the kind.
       (p_trigger = '{"kind": "call_linked"}'::jsonb))
     and jsonb_typeof(p_actions) = 'array'
     and jsonb_array_length(p_actions) between 1 and 5
     and not exists (
       select 1 from jsonb_array_elements(p_actions) a
        where jsonb_typeof(a) <> 'object'
           or coalesce(a ->> 'kind', '') not in ('brief', 'notify', 'todo', 'webhook', 'playbook')
           or (a ->> 'kind' = 'notify' and coalesce(a ->> 'to', '') not in ('rep', 'owner'))
           or (a ->> 'kind' = 'todo' and (length(btrim(coalesce(a ->> 'title', ''))) not between 1 and 200
                                          or coalesce(a ->> 'due_days', '0') !~ '^[0-9]{1,3}$')))
$$;

