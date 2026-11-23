-- 0326 — practice scenarios tagged with the rubric items they train (2026-11-23; OPEN.md stage-training '"rep needs" not
-- yet used — the stage's scenarios are not ranked by the rep's weakest rubric items'; gong.io capture M36 "just-in-time
-- training based on pipeline stage and rep needs").
--
-- A scenario's focus is free text, so nothing linked it to the rubric; ranking by guessing from words would be a claim
-- the data can't support (§3.4). A manager tags a scenario with the rubric items it practises (element ids from the
-- phone & video rubric). On a prospect, the stage's scenarios are then ordered by how often THIS rep has missed those
-- items lately (repNeeds.ts). Same shape as 0310's stage tags: append-only events, the current tags derived in a view.
-- Writes go through the manager route with the service role (no insert policy). Re-runnable.

create table if not exists public.training_scenario_elements (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  scenario_id uuid not null references public.training_scenarios(id),
  element_id text not null check (element_id ~ '^[A-Za-z0-9_.]{1,80}$'),
  is_on boolean not null,
  set_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists training_scenario_elements_idx on public.training_scenario_elements (company_id, scenario_id, element_id, id desc);
alter table public.training_scenario_elements enable row level security;
drop policy if exists rss_scen_elements_select on public.training_scenario_elements;
create policy rss_scen_elements_select on public.training_scenario_elements for select to authenticated
  using (company_id = auth_company_id());
drop policy if exists mfa_required on public.training_scenario_elements;
create policy mfa_required on public.training_scenario_elements as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule training_scenario_elements_no_update as on update to public.training_scenario_elements do instead nothing;
create or replace rule training_scenario_elements_no_delete as on delete to public.training_scenario_elements do instead nothing;

create or replace view public.training_scenario_elements_current with (security_invoker = true) as
select company_id, scenario_id, element_id, set_by, created_at
from (
  select distinct on (scenario_id, element_id) company_id, scenario_id, element_id, is_on, set_by, created_at
  from public.training_scenario_elements
  order by scenario_id, element_id, id desc
) latest
where is_on;
grant select on public.training_scenario_elements_current to authenticated;
