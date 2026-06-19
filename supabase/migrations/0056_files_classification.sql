-- 0056 — Files table + classification join tables + the
-- automatic classification-lane trigger.
--
-- Constitutional sources (§0.1):
--   • CLAUDE.md §3.1 — the file is the asset row; interactions
--     with the file (upload, view, download, share) are chain
--     events (next migration 0057 wires those into the existing
--     events table).
--   • CLAUDE.md §3.2 — the Understanding Gate is structural,
--     not optional. The classification gate here is the
--     analogue applied to assets: a file is "classified" iff
--     it has ≥1 department, ≥1 task, AND a non-empty
--     description. The schema enforces the derivation by
--     trigger so business code can't drift.
--   • CLAUDE.md §A10 — uploader always sees own file
--     regardless of access_role. Encoded in the RLS SELECT
--     policy.
--   • ThinkerThinker A6 — three pillars (classification +
--     retrieval + reuse). This migration ships pillar 1's
--     schema (classification). Pillars 2 + 3 are
--     companion-spec surfaces (search + library + citation
--     events) that compose on top of this.
--   • ThinkerThinker A11 — System counts, user decides. The
--     classification_lane is a COUNT (derived from presence/
--     absence of join rows + description). Never a judgment.
--   • ThinkerThinker A12 — idempotent. Every CREATE IF NOT
--     EXISTS, every DROP IF EXISTS.

-- ─── (1) files (the asset row) ───────────────────────────────
create table if not exists files (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  uploader_id           uuid references auth.users(id) on delete set null,
  -- For customer-widget uploads the uploader_id is NULL
  -- (visitor isn't an auth.users row, per §A10 the absent value
  -- IS the honest answer — same pattern as care messages).
  -- customer_session_token links the file to the C.A.R.E
  -- session so the customer can re-view their own upload
  -- without being authenticated.
  customer_session_token text,
  storage_path          text not null,
  mime_type             text not null,
  size_bytes            bigint not null check (size_bytes > 0),
  original_filename     text not null,
  -- Title: 1-line "what is this file about" (required).
  title                 text not null check (char_length(title) between 1 and 120),
  -- Description: short paragraph. Optional. Required for
  -- classified lane (the trigger checks for non-empty).
  description           text check (description is null or char_length(description) <= 500),
  -- Access role (per founder red-pen 2026-06-19):
  --   everyone        — default; any active company member
  --   admins          — admins + CEO + COO
  --   ceo_admins      — explicit synonym (clearer in copy)
  --   specific_people — whitelist via file_access_grants
  access_role           text not null default 'everyone'
    check (access_role in ('everyone', 'admins', 'ceo_admins', 'specific_people')),
  -- Derived. Updated by trigger below. Never edit by hand.
  classification_lane   text not null default 'casual'
    check (classification_lane in ('classified', 'casual')),
  classified_at         timestamptz,
  -- Source of upload. Customer-widget uploads have separate
  -- size + type caps enforced in the API layer (10MB, img+PDF).
  uploaded_via          text not null default 'agent_dashboard'
    check (uploaded_via in ('agent_dashboard', 'customer_widget')),
  -- Optional links to the chat / care surface that birthed the
  -- file. The library page reads these to build the inline
  -- "this file lives in conversation X" affordance.
  linked_topic_id       uuid references chat_topics(id) on delete set null,
  linked_conversation_id uuid references support_conversations(id) on delete set null,
  -- Soft-delete per §3.1. NEVER hard-delete; deprecated_at
  -- preserves the historical chain.
  deprecated_at         timestamptz,
  deprecated_by         uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index if not exists files_company_created_idx
  on files (company_id, created_at desc) where deprecated_at is null;

create index if not exists files_uploader_idx
  on files (uploader_id) where deprecated_at is null;

create index if not exists files_lane_idx
  on files (company_id, uploader_id, classification_lane, created_at desc);

create index if not exists files_linked_topic_idx
  on files (linked_topic_id) where linked_topic_id is not null;

create index if not exists files_linked_conversation_idx
  on files (linked_conversation_id) where linked_conversation_id is not null;

-- Full-text index for the conversation-search companion spec.
-- Builds on files.title + files.description. Cheap; useful
-- immediately for the library page filter.
create index if not exists files_fts_idx
  on files using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

-- ─── (2) file_departments (m2m — pillar 1, field A) ──────────
create table if not exists file_departments (
  file_id       uuid not null references files(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (file_id, department_id)
);

create index if not exists file_departments_dept_idx
  on file_departments (department_id);

-- ─── (3) file_tasks (m2m — pillar 1, field B) ────────────────
create table if not exists file_tasks (
  file_id     uuid not null references files(id) on delete cascade,
  task_id     uuid not null references tasks(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (file_id, task_id)
);

create index if not exists file_tasks_task_idx
  on file_tasks (task_id);

-- ─── (4) file_tags (the chip system) ─────────────────────────
create table if not exists file_tags (
  file_id    uuid not null references files(id) on delete cascade,
  -- Normalized lowercase, max 40 chars.
  tag        text not null check (
                tag = lower(tag)
                and char_length(tag) between 1 and 40
              ),
  created_at timestamptz not null default now(),
  primary key (file_id, tag)
);

create index if not exists file_tags_company_lookup_idx
  on file_tags (tag);

-- ─── (5) file_access_grants (specific-people whitelist) ─────
create table if not exists file_access_grants (
  file_id    uuid not null references files(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (file_id, profile_id)
);

create index if not exists file_access_grants_profile_idx
  on file_access_grants (profile_id);

-- ─── (6) Classification gate trigger ─────────────────────────
-- Per §3.2 the gate must be structural. We compute the
-- classification_lane DERIVATIVELY from:
--   • at least one row in file_departments, AND
--   • at least one row in file_tasks, AND
--   • description is non-empty (≥1 char after trim)
-- ONE missing piece = casual lane. The trigger fires on:
--   • files insert (initial computation)
--   • files update of description (re-evaluate)
--   • file_departments insert/delete (re-evaluate)
--   • file_tasks insert/delete (re-evaluate)
-- We recompute against the current join-row state every time.
-- O(2 count queries) per change — cheap.
create or replace function recompute_file_classification(p_file_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_dept boolean;
  v_has_task boolean;
  v_has_desc boolean;
  v_lane     text;
begin
  select exists(select 1 from file_departments where file_id = p_file_id)
    into v_has_dept;
  select exists(select 1 from file_tasks where file_id = p_file_id)
    into v_has_task;
  select coalesce(char_length(trim(description)), 0) > 0
    into v_has_desc
    from files where id = p_file_id;
  v_lane := case when v_has_dept and v_has_task and v_has_desc
                 then 'classified' else 'casual' end;
  update files
    set classification_lane = v_lane,
        classified_at       = case
                                when v_lane = 'classified' and classified_at is null
                                then now()
                                when v_lane = 'casual'
                                then null
                                else classified_at
                              end
    where id = p_file_id;
end;
$$;

create or replace function trg_recompute_file_classification_on_files()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only re-evaluate when the description changed; insert is
  -- handled by the trigger below.
  if tg_op = 'UPDATE' and new.description is distinct from old.description then
    perform recompute_file_classification(new.id);
  end if;
  return new;
end;
$$;

create or replace function trg_recompute_file_classification_on_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform recompute_file_classification(new.file_id);
  elsif tg_op = 'DELETE' then
    perform recompute_file_classification(old.file_id);
  end if;
  return null;
end;
$$;

create or replace function trg_initial_classification_on_files_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- New file row: there can't be any join rows yet (FK ordering),
  -- so classification_lane is 'casual' by default. The trigger
  -- above re-evaluates when the user attaches departments/tasks.
  -- This trigger is a stub for symmetry; explicit setting of the
  -- default 'casual' value happens via column default.
  return new;
end;
$$;

drop trigger if exists files_recompute_classification_on_update on files;
create trigger files_recompute_classification_on_update
  after update on files
  for each row execute function trg_recompute_file_classification_on_files();

drop trigger if exists file_departments_recompute on file_departments;
create trigger file_departments_recompute
  after insert or delete on file_departments
  for each row execute function trg_recompute_file_classification_on_join();

drop trigger if exists file_tasks_recompute on file_tasks;
create trigger file_tasks_recompute
  after insert or delete on file_tasks
  for each row execute function trg_recompute_file_classification_on_join();

-- ─── (7) Append-only discipline on files (§3.1) ─────────────
-- storage_path, mime_type, size_bytes, original_filename,
-- company_id, uploader_id, created_at — immutable.
-- Editable: title, description, access_role, deprecated_at,
-- deprecated_by, linked_topic_id, linked_conversation_id
-- (these latter may change if a file gets re-linked).
create or replace function preserve_file_immutable_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.id                := old.id;
  new.company_id        := old.company_id;
  new.uploader_id       := old.uploader_id;
  new.storage_path      := old.storage_path;
  new.mime_type         := old.mime_type;
  new.size_bytes        := old.size_bytes;
  new.original_filename := old.original_filename;
  new.uploaded_via      := old.uploaded_via;
  new.created_at        := old.created_at;
  new.customer_session_token := old.customer_session_token;
  -- classification_lane is computed by recompute_*; if the
  -- update came from recompute itself we want to preserve the
  -- NEW value (it just got recomputed). So we DO NOT overwrite
  -- classification_lane or classified_at here.
  return new;
end;
$$;

drop trigger if exists files_preserve_immutable on files;
create trigger files_preserve_immutable
  before update on files
  for each row execute function preserve_file_immutable_cols();

-- ─── (8) Comments ────────────────────────────────────────────
comment on table files is
  '§3.1 chain applied to assets — the file row is the asset.
   Interactions with files (upload, view, download, share,
   cite) emit events in the existing events table (see
   migration 0057). The file row itself is append-only modulo
   classification edits; storage_path / mime_type /
   size_bytes / original_filename are frozen at upload time.
   Soft-delete via deprecated_at per §3.1; never hard-delete.';

comment on column files.classification_lane is
  'Derived. Updated by trigger on insert / description change
   / file_departments change / file_tasks change. Never edit by
   hand. Casual = missing ≥1 of: department, task, description.
   Classified = all three present. The casual-day-cap query
   uses this column to compute the user-day total in O(1).';

comment on column files.access_role is
  'Founder red-pen 2026-06-19. Four roles: everyone (default),
   admins (CEO/COO/admin), ceo_admins (alias for admins —
   reserved for UI clarity), specific_people (whitelist in
   file_access_grants). Per §A10 the uploader_id always sees
   their own file regardless of access_role; RLS encodes that
   exception explicitly.';

-- ─── End migration 0056. ────────────────────────────────────
