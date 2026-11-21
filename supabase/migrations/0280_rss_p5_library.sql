-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0280 — RSS Phase 5: find and reuse (scaffold 0276_rss_p5_library.sql, renumbered; Gong F9.13, F12.2, F12.5, F12.6)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
--   1. Transcript search: a GIN index on coaching_transcript_segments (the live table behind 0269's _current view),
--      config 'simple' — exact words, no English stemming, because reps speak more than one language and a search
--      for a competitor's name must not be "helpfully" rewritten. Queried by src/lib/coach/remote/search.ts.
--   2. snippets — a stretch of one call (≥ 1 s). Never edited: a different cut is a new snippet.
--   3. library_folders — personal ("Mine") or company ("Company", managers create). No nesting this pass.
--   4. library_items — a whole call or a snippet in a folder. Append-only; taking one out is a row in
--      library_item_removals (§3.1), so "who put this in front of the team, and who took it down" survives.
--   5. saved_searches — a person's named filter set. Append-only; removal likewise a row.
--
-- WHERE THIS DIFFERS FROM THE SCAFFOLD, AND WHY
--   · Peer playback consent is NOT re-derived in SQL. The scaffold's rss_share_granted() placeholder would have been
--     a second copy of the consent rule that already exists as shareState() (src/lib/coach/recordings/shareState.ts,
--     over 0260's log) — §2.2. Peers read company items only through /api/coach/remote/library, which applies
--     shareState's `shareable` verdict per call; a revoked consent removes the item for peers on the next read.
--   · No client write policies (the pattern of every RSS table): routes write after their own checks.
--   · Read policies: your own folders/items/snippets/searches; a manager reads their company's under the 0273 tree.
--     Peers do not read company rows directly (see above).
--
-- Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rss_tree_allows') then
    raise exception 'RSS preflight: rss_tree_allows() not found — apply 0273 first';
  end if;
end $$;

-- ─── 1. transcript search ─────────────────────────────────────────────────────────────────────
create index if not exists coaching_transcript_segments_fts
  on public.coaching_transcript_segments using gin (to_tsvector('simple', text));

-- ─── 2. snippets ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.snippets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  rep_id uuid not null references public.profiles(id),
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null,
  title text not null check (length(trim(title)) between 1 and 120),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint snippets_min_length check (end_ms - start_ms >= 1000)
);
create index if not exists snippets_session_idx on public.snippets (session_id);
alter table public.snippets enable row level security;
drop policy if exists rss_snippets_select on public.snippets;
create policy rss_snippets_select on public.snippets for select to authenticated
  using (company_id = auth_company_id()
         and (created_by = auth.uid() or rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
create or replace rule snippets_no_update as on update to public.snippets do instead nothing;
create or replace rule snippets_no_delete as on delete to public.snippets do instead nothing;

-- ─── 3. folders ───────────────────────────────────────────────────────────────────────────────
create table if not exists public.library_folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  owner_id uuid not null references public.profiles(id),
  is_company boolean not null default false,
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create index if not exists library_folders_company_idx on public.library_folders (company_id, is_company);
alter table public.library_folders enable row level security;
drop policy if exists rss_folders_select on public.library_folders;
create policy rss_folders_select on public.library_folders for select to authenticated
  using (company_id = auth_company_id() and (owner_id = auth.uid() or is_company));
create or replace rule library_folders_no_update as on update to public.library_folders do instead nothing;
create or replace rule library_folders_no_delete as on delete to public.library_folders do instead nothing;

-- ─── 4. items + removals ──────────────────────────────────────────────────────────────────────
create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  folder_id uuid not null references public.library_folders(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  snippet_id uuid references public.snippets(id),
  rep_id uuid not null references public.profiles(id),
  note text check (note is null or length(note) <= 500),
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists library_items_folder_idx on public.library_items (folder_id, created_at desc);
alter table public.library_items enable row level security;
drop policy if exists rss_items_select on public.library_items;
create policy rss_items_select on public.library_items for select to authenticated
  using (company_id = auth_company_id()
         and (added_by = auth.uid() or rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
create or replace rule library_items_no_update as on update to public.library_items do instead nothing;
create or replace rule library_items_no_delete as on delete to public.library_items do instead nothing;

create table if not exists public.library_item_removals (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  item_id uuid not null references public.library_items(id),
  removed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists library_item_removals_item_idx on public.library_item_removals (item_id);
alter table public.library_item_removals enable row level security;
drop policy if exists rss_item_removals_select on public.library_item_removals;
create policy rss_item_removals_select on public.library_item_removals for select to authenticated
  using (company_id = auth_company_id() and (removed_by = auth.uid() or is_sales_coach_manager()));
create or replace rule library_item_removals_no_update as on update to public.library_item_removals do instead nothing;
create or replace rule library_item_removals_no_delete as on delete to public.library_item_removals do instead nothing;

-- ─── 5. saved searches ────────────────────────────────────────────────────────────────────────
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  owner_id uuid not null references public.profiles(id),
  name text not null check (length(trim(name)) between 1 and 60),
  filters jsonb not null,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_owner_idx on public.saved_searches (owner_id, created_at desc);
alter table public.saved_searches enable row level security;
drop policy if exists rss_saved_select on public.saved_searches;
create policy rss_saved_select on public.saved_searches for select to authenticated
  using (company_id = auth_company_id() and owner_id = auth.uid());
-- The one permitted change: stamping removed_at once (a person tidying their own list). Name and filters never change.
create or replace function public.rss_guard_saved_search_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.company_id is distinct from old.company_id or new.owner_id is distinct from old.owner_id
     or new.name is distinct from old.name or new.filters is distinct from old.filters
     or new.created_at is distinct from old.created_at or old.removed_at is not null then
    raise exception 'RSS: a saved search is never edited — save a new one';
  end if;
  return new;
end $$;
drop trigger if exists rss_guard_saved_search_update on public.saved_searches;
create trigger rss_guard_saved_search_update before update on public.saved_searches
  for each row execute function public.rss_guard_saved_search_update();
create or replace rule saved_searches_no_delete as on delete to public.saved_searches do instead nothing;
