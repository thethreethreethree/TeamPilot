-- 0276_rss_p5_library.sql
-- ELOSTATE Remote Sales System - Phase 5: find and reuse.
--   snippets (F9.13), library folders + items (F12.5, F12.6, F9.16), saved searches (F12.2),
--   full-text search over transcripts is added in Phase 5's code step against the live transcript
--   table (0269), whose exact name/columns must be read first - see docs/03.
--
-- Team visibility rule: a session or snippet reaches OTHER reps only through a company folder,
-- and only if the rep granted it through the existing consent flow (recording_share_events, 0260).

create table public.snippets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  rep_id uuid not null references public.profiles(id),
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null,
  title text not null check (length(trim(title)) > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (end_ms - start_ms >= 1000)
);

create table public.library_folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  owner_id uuid not null references public.profiles(id),
  is_company boolean not null default false,
  parent_id uuid references public.library_folders(id),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.library_folders(id) on delete cascade,
  session_id uuid references public.coaching_sessions(id) on delete cascade,
  snippet_id uuid references public.snippets(id) on delete cascade,
  note text,
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((session_id is null) <> (snippet_id is null))
);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null check (length(trim(name)) > 0),
  filters jsonb not null,
  created_at timestamptz not null default now()
);

-- PLACEHOLDER THAT ANNOUNCES ITSELF. Wire this to recording_share_events (0260) once its columns are
-- read: granted = latest grant/revoke event for this session is a grant. Until wired, adding anything
-- to a COMPANY folder fails with this message; personal folders work.
create function public.rss_share_granted(sid uuid) returns boolean
  language plpgsql stable security definer set search_path = public as $$
begin
  raise exception 'RSS: rss_share_granted() is not wired to recording_share_events yet (docs/03, Phase 5 step 1)';
end $$;

create function public.rss_folder_is_company(fid uuid) returns boolean
  language sql stable security definer set search_path = public as $$ select is_company from library_folders where id = fid $$;
create function public.rss_folder_owner(fid uuid) returns uuid
  language sql stable security definer set search_path = public as $$ select owner_id from library_folders where id = fid $$;
create function public.rss_folder_company(fid uuid) returns uuid
  language sql stable security definer set search_path = public as $$ select company_id from library_folders where id = fid $$;
create function public.rss_snippet_session(snid uuid) returns uuid
  language sql stable security definer set search_path = public as $$ select session_id from snippets where id = snid $$;

alter table public.snippets enable row level security;
alter table public.library_folders enable row level security;
alter table public.library_items enable row level security;
alter table public.saved_searches enable row level security;

create policy rss_snippets_select on public.snippets for select to authenticated
  using (rss_can_view_rep(auth.uid(), rep_id)
         or exists (select 1 from library_items li where li.snippet_id = snippets.id
                    and rss_folder_is_company(li.folder_id) and rss_folder_company(li.folder_id) = rss_company_of(auth.uid())));
create policy rss_snippets_insert on public.snippets for insert to authenticated
  with check (created_by = auth.uid() and rep_id = rss_session_rep(session_id) and rss_can_view_rep(auth.uid(), rep_id)
              and company_id = rss_company_of(auth.uid()));
-- Deliberately NO update policy: a snippet is re-cut, not edited. Delete by its creator only:
create policy rss_snippets_delete on public.snippets for delete to authenticated using (created_by = auth.uid());

create policy rss_folders_select on public.library_folders for select to authenticated
  using (owner_id = auth.uid() or (is_company and company_id = rss_company_of(auth.uid())));
create policy rss_folders_insert on public.library_folders for insert to authenticated
  with check (owner_id = auth.uid() and company_id = rss_company_of(auth.uid())
              and (not is_company or rss_is_manager(auth.uid())));
create policy rss_folders_update on public.library_folders for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy rss_items_select on public.library_items for select to authenticated
  using (rss_folder_owner(folder_id) = auth.uid()
         or (rss_folder_is_company(folder_id) and rss_folder_company(folder_id) = rss_company_of(auth.uid())));
create policy rss_items_insert on public.library_items for insert to authenticated
  with check (
    added_by = auth.uid()
    and rss_folder_company(folder_id) = rss_company_of(auth.uid())
    and (rss_folder_owner(folder_id) = auth.uid() or (rss_folder_is_company(folder_id) and rss_is_manager(auth.uid())))
    and rss_can_view_rep(auth.uid(), rss_session_rep(coalesce(session_id, rss_snippet_session(snippet_id))))
    -- CASE, not OR: Postgres does not promise OR short-circuits, and the share check must not run for personal folders.
    and (case when rss_folder_is_company(folder_id) then rss_share_granted(coalesce(session_id, rss_snippet_session(snippet_id))) else true end)
  );
create policy rss_items_delete on public.library_items for delete to authenticated
  using (added_by = auth.uid() or rss_folder_owner(folder_id) = auth.uid());

create policy rss_saved_all on public.saved_searches for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
