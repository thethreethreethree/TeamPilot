-- 0389 — the "gone quiet" agent trigger and on-demand agents (2026-11-27; Engage plan E8, E9; Gong F27.9, F27.2).
-- Re-runnable.
--
--   · agents.trigger kind 'deal_gone_quiet' (no parameters): for the "gone quiet" template. The nightly job fires it when
--     dealRisk raises gone_quiet on an open deal (no call in 21+ days) — dealRisk's verdict, consumed (§2.2) — once per
--     deal per quiet spell: the fire key is made of the deal and its last call, so a new call starts a new spell. Claimed
--     in agent_fires (0383) before acting, like close_date_near.
--   · on_demand_agents — a manager's named instruction for the company ("List the risks the customer raised"), run from a
--     deal's Ask box over that deal's calls. Never edited: retiring it is the only change (a new wording is a new row).
--     Everyone in the company can read the company's (they run them); only a sales-coach manager adds or retires one.
--     The instruction is the manager's text, not a customer's; answers are not stored — no erasure entry.

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
       (p_trigger = '{"kind": "deal_gone_quiet"}'::jsonb))
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

create table if not exists public.on_demand_agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  created_by uuid not null references public.profiles(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  instruction text not null check (length(btrim(instruction)) between 10 and 1000),
  created_at timestamptz not null default now(),
  retired_at timestamptz
);
create index if not exists on_demand_agents_company_idx on public.on_demand_agents (company_id, created_at desc);

create or replace function public.rss_guard_on_demand_agent_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - 'retired_at') is distinct from (to_jsonb(old) - 'retired_at') or old.retired_at is not null then
    raise exception 'an on-demand agent never changes — retire it and make a new one';
  end if;
  return new;
end $$;
drop trigger if exists rss_guard_on_demand_agent_update on public.on_demand_agents;
create trigger rss_guard_on_demand_agent_update before update on public.on_demand_agents for each row execute function public.rss_guard_on_demand_agent_update();
create or replace rule on_demand_agents_no_delete as on delete to public.on_demand_agents do instead nothing;

alter table public.on_demand_agents enable row level security;
drop policy if exists on_demand_agents_select on public.on_demand_agents;
create policy on_demand_agents_select on public.on_demand_agents for select to authenticated using (company_id = auth_company_id());
drop policy if exists on_demand_agents_insert on public.on_demand_agents;
create policy on_demand_agents_insert on public.on_demand_agents for insert to authenticated
  with check (company_id = auth_company_id() and created_by = auth.uid() and is_sales_coach_manager() and retired_at is null);
drop policy if exists on_demand_agents_update on public.on_demand_agents;
create policy on_demand_agents_update on public.on_demand_agents for update to authenticated
  using (company_id = auth_company_id() and is_sales_coach_manager()) with check (company_id = auth_company_id());
drop policy if exists mfa_required on public.on_demand_agents;
create policy mfa_required on public.on_demand_agents as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
