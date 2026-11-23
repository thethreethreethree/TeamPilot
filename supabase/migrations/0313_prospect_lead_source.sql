-- 0313 — lead source on prospects (2026-11-23; gong.io capture M36 "Analyze deals by lead source/campaign (blog, chat,
-- direct mail, event)", graded LACK: "No source field on prospects").
--
-- Where a prospect came from is one more FACT about it (§3.1): a 'source' event ({ text }), like organization. The
-- current source is derived — the latest event — in remote_prospects_current, which gains a `source` column at the END
-- (create or replace view may only append columns). rss_create_prospect takes an optional p_source so a new prospect's
-- first facts stay one transaction (0304). Re-runnable.

alter table public.remote_prospect_events drop constraint if exists remote_prospect_events_kind_check;
alter table public.remote_prospect_events add constraint remote_prospect_events_kind_check
  check (kind in ('name', 'organization', 'stage', 'amount', 'next_call', 'source'));
alter table public.remote_prospect_events drop constraint if exists remote_prospect_events_source;
alter table public.remote_prospect_events add constraint remote_prospect_events_source
  check (kind <> 'source' or (jsonb_typeof(value -> 'text') = 'string' and length(trim(value ->> 'text')) between 1 and 60));

-- 0303's view, column for column, plus `source` last. security_invoker: the caller's RLS applies.
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
  (select e.value ->> 'text' from remote_prospect_events e where e.prospect_id = p.id and e.kind = 'source' order by e.id desc limit 1) as source
from remote_prospects p;
grant select on public.remote_prospects_current to authenticated, service_role;

-- 0304's function with p_source added (last, defaulted). The old 6-argument form is dropped so a call can never pick
-- the wrong overload.
drop function if exists public.rss_create_prospect(text, text, numeric, text, date, uuid);
create or replace function public.rss_create_prospect(
  p_name text,
  p_organization text default null,
  p_amount numeric default null,
  p_stage_label text default null,
  p_next_call date default null,
  p_session uuid default null,
  p_source text default null
) returns uuid
  language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid := auth_company_id();
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null or v_company is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'a prospect needs a name' using errcode = '22023'; end if;
  insert into remote_prospects (company_id, rep_id, created_by) values (v_company, v_me, v_me) returning id into v_id;
  insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
    values (v_id, v_company, 'name', jsonb_build_object('text', left(trim(p_name), 120)), v_me);
  if p_organization is not null and length(trim(p_organization)) > 0 then
    insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
      values (v_id, v_company, 'organization', jsonb_build_object('text', left(trim(p_organization), 120)), v_me);
  end if;
  insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
    values (v_id, v_company, 'stage',
            case when p_stage_label is not null and length(trim(p_stage_label)) > 0
                 then jsonb_build_object('status', 'open', 'label', left(trim(p_stage_label), 60))
                 else jsonb_build_object('status', 'open') end, v_me);
  if p_amount is not null then
    insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
      values (v_id, v_company, 'amount', jsonb_build_object('amount', p_amount), v_me);
  end if;
  if p_next_call is not null then
    insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
      values (v_id, v_company, 'next_call', jsonb_build_object('date', p_next_call::text), v_me);
  end if;
  if p_source is not null and length(trim(p_source)) > 0 then
    insert into remote_prospect_events (prospect_id, company_id, kind, value, actor_id)
      values (v_id, v_company, 'source', jsonb_build_object('text', left(trim(p_source), 60)), v_me);
  end if;
  if p_session is not null then
    insert into remote_prospect_calls (prospect_id, session_id, company_id, linked_by) values (v_id, p_session, v_company, v_me);
  end if;
  return v_id;
end $$;
revoke all on function public.rss_create_prospect(text, text, numeric, text, date, uuid, text) from public, anon;
grant execute on function public.rss_create_prospect(text, text, numeric, text, date, uuid, text) to authenticated;
