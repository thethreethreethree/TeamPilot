-- 0372 — the facts behind Gong's deal warnings, read per deal (2026-11-27; revenue Phase 3a, docs/ELOSTATE-REVENUE-BUILD-PLAN;
-- Gong F20.5: ghosted, not enough contacts, no power, pricing not mentioned, stalled in stage). Re-runnable.
--
-- dealRisk.ts stays the one authority for a deal's risk (§2.2); it needs facts the pipeline list didn't carry. This
-- function returns them for a set of deals, as the CALLER (security invoker: prospects', calls', transcripts' and
-- contacts' own RLS decide what counts — a hidden call's words never count):
--   · last_two_way_at   — the latest linked call on which the customer spoke (Gong counts only two-way engagement)
--   · pricing_mentioned — any linked call's current transcript says price / pricing / cost / budget / quote / discount
--   · stage_entered_at  — when the deal's current stage label was set (the first event of the latest run of that label)
--   · contacts          — each contact on the deal: title and the last linked call they were on
-- And the stage list gains an optional per-stage limit, stall_days (1–365), for "stalled in stage".

create or replace function public.rss_valid_stage_list(p jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) between 1 and 20
     and not exists (
       select 1 from jsonb_array_elements(p) s
        where jsonb_typeof(s) <> 'object'
           or jsonb_typeof(s -> 'name') <> 'string'
           or length(btrim(s ->> 'name')) not between 1 and 60
           or coalesce(s ->> 'kind', '') not in ('open', 'won', 'lost')
           -- 0372: an optional whole number of days a deal may sit in this stage
           or (s ? 'stall_days' and jsonb_typeof(s -> 'stall_days') <> 'null'
               and not (jsonb_typeof(s -> 'stall_days') = 'number' and (s ->> 'stall_days') ~ '^[0-9]+$'
                        and (s ->> 'stall_days')::int between 1 and 365)))
     and (select count(distinct lower(btrim(s ->> 'name'))) from jsonb_array_elements(p) s) = jsonb_array_length(p)
     and exists (select 1 from jsonb_array_elements(p) s where s ->> 'kind' = 'open')
$$;

create or replace function public.rss_deal_signals(p_ids uuid[])
returns table (prospect_id uuid, last_two_way_at timestamptz, pricing_mentioned boolean, stage_entered_at timestamptz, contacts jsonb)
  language sql stable security invoker set search_path = public as $$
  with deals as (
    select p.id from remote_prospects p where p.id = any (p_ids)
  ),
  calls as (
    select c.prospect_id, s.id as session_id, s.started_at
      from remote_prospect_calls c join coaching_sessions s on s.id = c.session_id
     where c.prospect_id in (select id from deals)
  ),
  stage_runs as (
    -- each stage event, and whether its label differs from the one before it
    select e.prospect_id, e.id, e.created_at, coalesce(e.value ->> 'label', '') as label,
           coalesce(lag(coalesce(e.value ->> 'label', '')) over (partition by e.prospect_id order by e.id), '__none__') as prev
      from remote_prospect_events e
     where e.kind = 'stage' and e.prospect_id in (select id from deals)
  )
  select d.id,
         (select max(c.started_at) from calls c
           where c.prospect_id = d.id
             and exists (select 1 from coaching_transcript_segments_current t where t.session_id = c.session_id and t.speaker = 'customer')),
         exists (select 1 from calls c join coaching_transcript_segments_current t on t.session_id = c.session_id
                  where c.prospect_id = d.id and t.text ~* '\m(price|prices|pricing|cost|costs|budget|quote|discount)\M'),
         (select max(r.created_at) from stage_runs r where r.prospect_id = d.id and r.label <> r.prev),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'title', cc.title,
                     'last_on_call', (select max(c.started_at) from calls c join call_contacts_current k on k.session_id = c.session_id
                                       where c.prospect_id = d.id and k.contact_id = dc.contact_id and k.linked)))
                     from deal_contacts_current dc join contacts_current cc on cc.id = dc.contact_id
                    where dc.prospect_id = d.id and dc.role <> 'removed'), '[]'::jsonb)
    from deals d
$$;

revoke all on function public.rss_deal_signals(uuid[]) from public, anon;
grant execute on function public.rss_deal_signals(uuid[]) to authenticated, service_role;
