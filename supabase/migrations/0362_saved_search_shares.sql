-- 0362 — share a saved search with the company (2026-11-26; Gong ledger F12.7 "Streams … private or company").
-- Idempotent (A12).
--
-- A manager can put one of their saved searches in front of the team: anyone in the company sees it under Saved
-- searches and can follow it (0342's follow / unfollow / seen rows, written under the FOLLOWER's own id). What a share
-- shares is the FILTER, never calls: each follower's count runs through their own access (the reporting tree and hidden
-- calls), as their own follows do. Each change is a row (share / unshare; the latest per search wins). Written by
-- /api/coach/remote/saved-searches/events with the service role after its checks (the owner, a manager); read by the
-- company. Carries the 0309 mfa_required policy from the start.

create table if not exists public.saved_search_shares (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  search_id uuid not null references public.saved_searches(id),
  kind text not null check (kind in ('share', 'unshare')),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists saved_search_shares_idx on public.saved_search_shares (company_id, search_id, id desc);
alter table public.saved_search_shares enable row level security;
drop policy if exists saved_search_shares_select on public.saved_search_shares;
create policy saved_search_shares_select on public.saved_search_shares for select to authenticated using (company_id = auth_company_id());
drop policy if exists mfa_required on public.saved_search_shares;
create policy mfa_required on public.saved_search_shares as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule saved_search_shares_no_update as on update to public.saved_search_shares do instead nothing;
create or replace rule saved_search_shares_no_delete as on delete to public.saved_search_shares do instead nothing;
