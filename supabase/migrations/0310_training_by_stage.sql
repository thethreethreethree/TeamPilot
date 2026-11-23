-- 0310 — training by deal stage (2026-11-23; gong.io capture M36 "Deliver just-in-time training based on pipeline
-- stage and rep needs"; founder picker 2026-11-23: "Rep starts it").
--
-- A manager tags a practice scenario with a pipeline stage name ("Demo", "Negotiation"). A rep whose OPEN prospect is
-- at that stage sees the scenario on the prospect and starts it as their own practice (a training_assignments row
-- with assigned_by = the rep — "self-started"), due on the prospect's next call date.
--
-- Stage names are free text on each prospect (0303), so the match is on a normalised key: trimmed, inner spaces
-- collapsed, lower case (src/lib/coach/remote/stageTraining.ts stageKey mirrors rss_stage_key term-for-term, §2.2).
--
-- Append-only (§3.1): tagging and untagging are events; the current tags are DERIVED (the view). Writes go through the
-- manager route with the service role, so there is no insert policy. Re-runnable.

create or replace function public.rss_stage_key(label text) returns text
language sql immutable
set search_path = ''
as $$ select lower(regexp_replace(trim(coalesce(label, '')), '\s+', ' ', 'g')) $$;

create table if not exists public.training_scenario_stages (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  scenario_id uuid not null references public.training_scenarios(id),
  stage_label text not null check (length(trim(stage_label)) between 1 and 60),
  stage_key text not null check (stage_key = public.rss_stage_key(stage_label)),
  is_on boolean not null,
  set_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists training_scenario_stages_idx on public.training_scenario_stages (company_id, scenario_id, stage_key, id desc);
alter table public.training_scenario_stages enable row level security;
drop policy if exists rss_scen_stages_select on public.training_scenario_stages;
create policy rss_scen_stages_select on public.training_scenario_stages for select to authenticated
  using (company_id = auth_company_id());
-- 0309: every table that grants access also requires a passed code when the person turned codes on.
drop policy if exists mfa_required on public.training_scenario_stages;
create policy mfa_required on public.training_scenario_stages as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule training_scenario_stages_no_update as on update to public.training_scenario_stages do instead nothing;
create or replace rule training_scenario_stages_no_delete as on delete to public.training_scenario_stages do instead nothing;

-- The tags in force: the latest event per (scenario, stage key) that is "on". security_invoker: the caller's RLS applies.
create or replace view public.training_scenario_stages_current with (security_invoker = true) as
select company_id, scenario_id, stage_key, stage_label, set_by, created_at
from (
  select distinct on (scenario_id, stage_key) company_id, scenario_id, stage_key, stage_label, is_on, set_by, created_at
  from public.training_scenario_stages
  order by scenario_id, stage_key, id desc
) latest
where is_on;
grant select on public.training_scenario_stages_current to authenticated;
