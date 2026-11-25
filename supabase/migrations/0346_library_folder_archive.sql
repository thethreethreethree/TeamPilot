-- 0346 — archive a library folder (2026-11-26; Gong ledger F12.6: "archiving a folder leaves calls searchable").
-- An archived folder leaves the library list with its items; nothing is removed, the calls stay in Search, and it can
-- be restored. Each change is a row (append-only); the latest per folder wins. Written by /api/coach/remote/library
-- with the service role after its own check (a personal folder: its owner; a company folder: a manager). Read like
-- the folders themselves: through the folder's own read rule (the subquery runs under library_folders' RLS).
create table if not exists public.library_folder_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  folder_id uuid not null references public.library_folders(id),
  kind text not null check (kind in ('archive', 'restore')),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists library_folder_events_idx on public.library_folder_events (folder_id, id desc);
alter table public.library_folder_events enable row level security;
drop policy if exists library_folder_events_select on public.library_folder_events;
create policy library_folder_events_select on public.library_folder_events for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from public.library_folders f where f.id = library_folder_events.folder_id));
drop policy if exists mfa_required on public.library_folder_events;
create policy mfa_required on public.library_folder_events as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule library_folder_events_no_update as on update to public.library_folder_events do instead nothing;
create or replace rule library_folder_events_no_delete as on delete to public.library_folder_events do instead nothing;
