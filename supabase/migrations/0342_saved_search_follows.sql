-- 0342 — follow a saved search and see the calls that matched since you last looked (2026-11-26; Gong ledger F12.7
-- "Streams": Gong adds new calls to a person's saved filter and alerts them).
--
-- Each change is a row (append-only): 'follow' / 'unfollow' turn the alert on or off, 'seen' records that the person
-- opened the search. The latest follow/unfollow per search wins; "new" = calls that STARTED after the later of the last
-- follow and the last seen. The matching itself is NOT stored: it runs on read through the person's own access (the
-- reporting tree and hidden calls, 0337/0341), so a follow can never surface a call its owner couldn't open.
-- Written by /api/coach/remote/saved-searches/* with the service role, owner and company from the session.
create table if not exists public.saved_search_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  owner_id uuid not null references public.profiles(id),
  search_id uuid not null references public.saved_searches(id),
  kind text not null check (kind in ('follow', 'unfollow', 'seen')),
  created_at timestamptz not null default now()
);
create index if not exists saved_search_events_idx on public.saved_search_events (owner_id, search_id, id desc);
alter table public.saved_search_events enable row level security;
drop policy if exists rss_saved_search_events_select on public.saved_search_events;
create policy rss_saved_search_events_select on public.saved_search_events for select to authenticated
  using (owner_id = auth.uid() and company_id = auth_company_id());
drop policy if exists mfa_required on public.saved_search_events;
create policy mfa_required on public.saved_search_events as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule saved_search_events_no_update as on update to public.saved_search_events do instead nothing;
create or replace rule saved_search_events_no_delete as on delete to public.saved_search_events do instead nothing;
