-- 0319 — topic groups for Market (2026-11-23; founder picker 2026-11-23: "AI suggests, manager OKs").
--
-- Market already counts a topic once however it was WORDED (market.ts topicKey). Topics that MEAN the same in different
-- words ("pricing", "monthly price", "monthly bill amount") stay separate unless a manager groups them. The AI may
-- SUGGEST groups from the company's own topics; nothing is stored until a manager accepts (or writes) a group, and only
-- stored groups change the counts.
--
-- A group is a fact over time (§3.1): changing one retires it and writes a new one; ungrouping retires it. Members are
-- topic wordings raised on at least two calls (the route enforces it), lower-cased — topics, not one customer's words.
-- Written by the manager route with the service role after requireSalesCoachManager, so no insert policy.
-- Re-runnable.

create table if not exists public.market_topic_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null check (length(trim(name)) between 1 and 80),
  members text[] not null check (cardinality(members) between 2 and 40),
  source text not null check (source in ('ai_suggested', 'manager')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists market_topic_groups_company_idx on public.market_topic_groups (company_id, created_at desc);

create table if not exists public.market_topic_group_retirements (
  group_id uuid primary key references public.market_topic_groups(id),
  company_id uuid not null references public.companies(id),
  retired_by uuid not null references public.profiles(id),
  retired_at timestamptz not null default now()
);

alter table public.market_topic_groups enable row level security;
alter table public.market_topic_group_retirements enable row level security;

drop policy if exists market_topic_groups_select on public.market_topic_groups;
create policy market_topic_groups_select on public.market_topic_groups for select to authenticated
  using (company_id = auth_company_id());
drop policy if exists market_topic_group_retirements_select on public.market_topic_group_retirements;
create policy market_topic_group_retirements_select on public.market_topic_group_retirements for select to authenticated
  using (company_id = auth_company_id());

drop policy if exists mfa_required on public.market_topic_groups;
create policy mfa_required on public.market_topic_groups as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
drop policy if exists mfa_required on public.market_topic_group_retirements;
create policy mfa_required on public.market_topic_group_retirements as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));

create or replace rule market_topic_groups_no_update as on update to public.market_topic_groups do instead nothing;
create or replace rule market_topic_groups_no_delete as on delete to public.market_topic_groups do instead nothing;
create or replace rule market_topic_group_retirements_no_update as on update to public.market_topic_group_retirements do instead nothing;
create or replace rule market_topic_group_retirements_no_delete as on delete to public.market_topic_group_retirements do instead nothing;
