-- 0379 — agents (2026-11-27; docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN Phase E5; Gong M27 F27.3–F27.6). Re-runnable.
--
--   · agents — a manager's automation: one trigger (a deal reaching a stage, won or lost) and actions in order (write the
--     deal brief, notify the deal's rep or the owner, add a to-do, send a webhook). Made by an admin or Sales Coach
--     manager; the triggers and actions are checked (rss_valid_agent). Never edited: turning it on or off and retiring
--     are the changes its guard allows (a different agent is a new one).
--   · agent_runs — every run: which deal, when, whether it worked and what each action did. Written by the runner (the
--     service role) only.
-- Run as (F27.5): an agent acts on a deal only if its owner could see that deal (rss_agent_can_see: the deal's rep, or
-- a lead the reporting tree allows). Notifications gain 'agent_ran'; webhooks gain 'agent.ran' (their closed sets).

create or replace function public.rss_valid_agent(p_trigger jsonb, p_actions jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(p_trigger) = 'object'
     and coalesce(p_trigger ->> 'kind', '') = 'deal_stage'
     and (p_trigger ->> 'status' is null or p_trigger ->> 'status' in ('open', 'won', 'lost'))
     and (p_trigger ->> 'label' is null or length(btrim(p_trigger ->> 'label')) between 1 and 60)
     and (p_trigger ? 'status' or p_trigger ? 'label')
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

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  owner_id uuid not null references public.profiles(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  trigger jsonb not null,
  actions jsonb not null,
  enabled boolean not null default true,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agents_valid check (public.rss_valid_agent(trigger, actions))
);
create index if not exists agents_company_idx on public.agents (company_id) where retired_at is null;

create table if not exists public.agent_runs (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.agents(id),
  company_id uuid not null references public.companies(id),
  prospect_id uuid references public.remote_prospects(id),
  test boolean not null default false,
  ok boolean not null,
  skipped text check (skipped is null or length(skipped) <= 200),
  results jsonb not null default '[]'::jsonb check (jsonb_typeof(results) = 'array'),
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_agent_idx on public.agent_runs (agent_id, id desc);

create or replace function public.rss_guard_agent_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - 'enabled' - 'retired_at') is distinct from (to_jsonb(old) - 'enabled' - 'retired_at') or old.retired_at is not null then
    raise exception 'an agent never changes — turn it on or off, or retire it and make a new one';
  end if;
  return new;
end $$;
drop trigger if exists rss_guard_agent_update on public.agents;
create trigger rss_guard_agent_update before update on public.agents for each row execute function public.rss_guard_agent_update();
create or replace rule agents_no_delete as on delete to public.agents do instead nothing;
create or replace rule agent_runs_no_update as on update to public.agent_runs do instead nothing;
create or replace rule agent_runs_no_delete as on delete to public.agent_runs do instead nothing;

alter table public.agents enable row level security;
alter table public.agent_runs enable row level security;
drop policy if exists agents_select on public.agents;
create policy agents_select on public.agents for select to authenticated using (company_id = auth_company_id() and is_sales_coach_manager());
drop policy if exists agents_insert on public.agents;
create policy agents_insert on public.agents for insert to authenticated
  with check (company_id = auth_company_id() and owner_id = auth.uid() and is_sales_coach_manager());
drop policy if exists agents_update on public.agents;
create policy agents_update on public.agents for update to authenticated
  using (company_id = auth_company_id() and is_sales_coach_manager()) with check (company_id = auth_company_id());
drop policy if exists agent_runs_select on public.agent_runs;
create policy agent_runs_select on public.agent_runs for select to authenticated using (company_id = auth_company_id() and is_sales_coach_manager());
do $$
declare t text;
begin
  foreach t in array array['agents', 'agent_runs'] loop
    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format('create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()))', t);
  end loop;
end $$;

-- Run as the owner (F27.5): may this owner see this rep's deal? The rep themself, or an active lead of the same company
-- the reporting tree allows (rss_can_view_rep, 0273). Service role only: the runner asks it before acting.
create or replace function public.rss_agent_can_see(p_owner uuid, p_rep uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_owner = p_rep or exists (
    select 1 from profiles o join profiles r on r.id = p_rep
     where o.id = p_owner and o.company_id = r.company_id and o.status <> 'removed'
       and (o.role = any (admin_roles()) or o.sales_coach_role = 'admin')
       and (not rss_tree_active(o.company_id) or rss_can_view_rep(p_owner, p_rep)))
$$;
revoke all on function public.rss_agent_can_see(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rss_agent_can_see(uuid, uuid) to service_role;

-- 0336's closed set plus 'agent_ran'.
alter table manager_notifications drop constraint if exists manager_notifications_type_check;
alter table manager_notifications
  add constraint manager_notifications_type_check
  check (type in (
    'strong_session', 'deal_closed', 'pitch_score_corrected', 'recording_comment', 'recording_share_requested',
    'pattern_coached', 'pattern_clip_disputed', 'feedback_requested', 'training_attempted', 'call_ready',
    'comment_mention', 'score_disputed', 'dispute_answered', 'call_scored', 'call_access_granted',
    'agent_ran'
  ));
-- 0330's closed sets plus 'agent.ran'.
alter table public.webhook_endpoints drop constraint if exists webhook_endpoints_events_check;
alter table public.webhook_endpoints add constraint webhook_endpoints_events_check
  check (cardinality(events) > 0 and events <@ array['session.scored', 'session.closed', 'deal.closed', 'call.to_crm', 'agent.ran']);
alter table public.webhook_deliveries drop constraint if exists webhook_deliveries_event_check;
alter table public.webhook_deliveries add constraint webhook_deliveries_event_check
  check (event in ('session.scored', 'session.closed', 'deal.closed', 'ping', 'call.to_crm', 'agent.ran'));
