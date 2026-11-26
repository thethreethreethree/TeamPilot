-- 0375 — when a deal closed, and an account's two-way calls (2026-11-27; revenue Phase 4, docs/ELOSTATE-REVENUE-BUILD-PLAN;
-- Gong F20.10 win/loss by deal duration, F21.4 account activity level). Re-runnable.
--
--   · rss_deal_signals gains closed_at: when the deal's status last became won or lost (the stage event that changed
--     the status). 0372's body, column for column, plus that one column at the end (a function's result type can only
--     change by drop and create, so it is dropped first; its only caller is listProspects).
--   · rss_account_activity(accounts) — for each account the caller can see, the start of every call in the last year on
--     one of its deals where the customer spoke (Gong counts only two-way engagement). Security invoker: prospects',
--     calls' and transcripts' RLS apply, so a call the person can't open never counts.

drop function if exists public.rss_deal_signals(uuid[]);
create function public.rss_deal_signals(p_ids uuid[])
returns table (prospect_id uuid, last_two_way_at timestamptz, pricing_mentioned boolean, stage_entered_at timestamptz, contacts jsonb, closed_at timestamptz)
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
    select e.prospect_id, e.id, e.created_at, coalesce(e.value ->> 'label', '') as label,
           coalesce(lag(coalesce(e.value ->> 'label', '')) over (partition by e.prospect_id order by e.id), '__none__') as prev,
           coalesce(e.value ->> 'status', 'open') as status,
           coalesce(lag(coalesce(e.value ->> 'status', 'open')) over (partition by e.prospect_id order by e.id), 'open') as prev_status
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
                    where dc.prospect_id = d.id and dc.role <> 'removed'), '[]'::jsonb),
         (select max(r.created_at) from stage_runs r
           where r.prospect_id = d.id and r.status in ('won', 'lost') and r.status <> r.prev_status)
    from deals d
$$;
revoke all on function public.rss_deal_signals(uuid[]) from public, anon;
grant execute on function public.rss_deal_signals(uuid[]) to authenticated, service_role;

create or replace function public.rss_account_activity(p_accounts uuid[])
returns table (account_id uuid, call_at timestamptz)
  language sql stable security invoker set search_path = public as $$
  select acc.account_id, s.started_at
    from (
      -- each deal's CURRENT account (the latest 'account' event)
      select distinct on (e.prospect_id) e.prospect_id, nullif(e.value ->> 'account_id', '')::uuid as account_id
        from remote_prospect_events e
       where e.kind = 'account'
       order by e.prospect_id, e.id desc
    ) acc
    join remote_prospect_calls c on c.prospect_id = acc.prospect_id
    join coaching_sessions s on s.id = c.session_id
   where acc.account_id = any (p_accounts)
     and s.started_at > now() - interval '365 days'
     and exists (select 1 from coaching_transcript_segments_current t where t.session_id = s.id and t.speaker = 'customer')
$$;
revoke all on function public.rss_account_activity(uuid[]) from public, anon;
grant execute on function public.rss_account_activity(uuid[]) to authenticated, service_role;
