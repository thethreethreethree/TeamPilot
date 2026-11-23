-- 0318 — adoption goals for tracked messages (2026-11-23; ledger F18.3 "High- and low-adoption goals", graded LACK).
--
-- A manager says how often a tracked message SHOULD be said: "at least 60% of calls" for a new offer line, or "at most
-- 5%" for a line the team was asked to stop using. The Adoption view (adoption.ts) shows the actual share against it.
-- A goal is a fact over time (§3.1): setting or clearing one appends a row; the current goal is the latest row (a row
-- with no target clears it). Written by the manager route with the service role after its checks, so no insert policy.
-- Re-runnable.

create table if not exists public.tracker_goals (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  tracker_id uuid not null references public.keyword_trackers(id),
  direction text check (direction in ('at_least', 'at_most')),
  target_pct smallint check (target_pct between 0 and 100),
  set_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint tracker_goals_both_or_neither check ((direction is null) = (target_pct is null))
);
create index if not exists tracker_goals_idx on public.tracker_goals (tracker_id, id desc);
alter table public.tracker_goals enable row level security;
drop policy if exists tracker_goals_select on public.tracker_goals;
create policy tracker_goals_select on public.tracker_goals for select to authenticated
  using (company_id = auth_company_id());
drop policy if exists mfa_required on public.tracker_goals;
create policy mfa_required on public.tracker_goals as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule tracker_goals_no_update as on update to public.tracker_goals do instead nothing;
create or replace rule tracker_goals_no_delete as on delete to public.tracker_goals do instead nothing;
