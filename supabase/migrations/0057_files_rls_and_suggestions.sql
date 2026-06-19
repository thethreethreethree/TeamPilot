-- 0057 — RLS for files + join tables, the classification
-- suggestions audit table (§A10/§A11), the casual-cap helper,
-- and the events vocabulary extension for asset.* kinds.
--
-- Constitutional sources (§0.1):
--   • §A10 — uploader always sees own file. Encoded as the
--     primary OR clause in the SELECT policy below.
--   • §A11 — System counts, user decides. The suggestions
--     table records what the AI proposed AND whether the user
--     accepted; the audit lets §3.5 measure DOWNSTREAM
--     consequence (was the corrected classification retrieved
--     more than the System's suggestion would have been?),
--     not adoption.
--   • §3.1 — append-only chain. Events emitted via the
--     existing events table; this migration just declares the
--     new kinds and provides idempotent helpers.
--   • §3.4 — no instant results. The suggestions table tracks
--     the AI from day one so we have honest baseline data;
--     the System never auto-accepts.
--   • §A12 — every CREATE/DROP idempotent.

-- ─── (1) RLS on files ────────────────────────────────────────
alter table files enable row level security;
alter table file_departments enable row level security;
alter table file_tasks enable row level security;
alter table file_tags enable row level security;
alter table file_access_grants enable row level security;

-- The cross-tenant isolation check: caller must be in the
-- file's company. Used by every files-table policy.
-- We DO NOT scope by department or anything else here; that
-- granularity belongs to access_role.

drop policy if exists files_select on files;
create policy files_select on files
  for select
  using (
    -- Cross-tenant gate first — never see another company's
    -- files regardless of access_role.
    company_id in (select company_id from profiles where id = auth.uid())
    and (
      -- §A10: uploader ALWAYS sees own, regardless of role gate.
      uploader_id = auth.uid()
      or
      -- Otherwise the role gate applies.
      case access_role
        when 'everyone' then true
        when 'admins' then exists (
          select 1 from profiles
          where id = auth.uid()
            and company_id = files.company_id
            and role in ('CEO', 'COO', 'admin')
        )
        when 'ceo_admins' then exists (
          select 1 from profiles
          where id = auth.uid()
            and company_id = files.company_id
            and role in ('CEO', 'COO', 'admin')
        )
        when 'specific_people' then exists (
          select 1 from file_access_grants
          where file_id = files.id
            and profile_id = auth.uid()
        )
        else false
      end
    )
    and deprecated_at is null
  );

-- Insert: any active company member. Uploader_id must match
-- caller (no impersonation). Customer-widget uploads use the
-- service-role client and bypass RLS entirely — that path
-- enforces the customer_session_token check in the API layer.
drop policy if exists files_insert on files;
create policy files_insert on files
  for insert
  with check (
    uploader_id = auth.uid()
    and company_id in (select company_id from profiles where id = auth.uid())
  );

-- Update: uploader can edit title, description, access_role,
-- linked_topic_id, linked_conversation_id, deprecated_at on
-- own files. Admins can update any file in their company.
-- The append-only trigger from 0056 prevents writes to the
-- immutable cols regardless.
drop policy if exists files_update on files;
create policy files_update on files
  for update
  using (
    uploader_id = auth.uid()
    or exists (
      select 1 from profiles
      where id = auth.uid()
        and company_id = files.company_id
        and role in ('CEO', 'COO', 'admin')
    )
  );

-- Delete: forbidden at the row level. Use deprecated_at via
-- update. No DELETE policy = denied for everyone.

-- ─── (2) RLS on the join tables ──────────────────────────────
-- Each join row inherits visibility from the parent file row.
-- The simplest correct rule: if you can SELECT the file, you
-- can SELECT its join rows. If you can UPDATE the file, you
-- can INSERT/DELETE its join rows.

drop policy if exists file_departments_select on file_departments;
create policy file_departments_select on file_departments
  for select
  using (
    exists (select 1 from files where files.id = file_departments.file_id)
  );

drop policy if exists file_departments_write on file_departments;
create policy file_departments_write on file_departments
  for all
  using (
    exists (
      select 1 from files
      where files.id = file_departments.file_id
        and (
          files.uploader_id = auth.uid()
          or exists (
            select 1 from profiles
            where id = auth.uid()
              and company_id = files.company_id
              and role in ('CEO', 'COO', 'admin')
          )
        )
    )
  );

drop policy if exists file_tasks_select on file_tasks;
create policy file_tasks_select on file_tasks
  for select
  using (
    exists (select 1 from files where files.id = file_tasks.file_id)
  );

drop policy if exists file_tasks_write on file_tasks;
create policy file_tasks_write on file_tasks
  for all
  using (
    exists (
      select 1 from files
      where files.id = file_tasks.file_id
        and (
          files.uploader_id = auth.uid()
          or exists (
            select 1 from profiles
            where id = auth.uid()
              and company_id = files.company_id
              and role in ('CEO', 'COO', 'admin')
          )
        )
    )
  );

drop policy if exists file_tags_select on file_tags;
create policy file_tags_select on file_tags
  for select
  using (
    exists (select 1 from files where files.id = file_tags.file_id)
  );

drop policy if exists file_tags_write on file_tags;
create policy file_tags_write on file_tags
  for all
  using (
    exists (
      select 1 from files
      where files.id = file_tags.file_id
        and (
          files.uploader_id = auth.uid()
          or exists (
            select 1 from profiles
            where id = auth.uid()
              and company_id = files.company_id
              and role in ('CEO', 'COO', 'admin')
          )
        )
    )
  );

drop policy if exists file_access_grants_select on file_access_grants;
create policy file_access_grants_select on file_access_grants
  for select
  using (
    -- A user sees grants that affect them OR grants on their
    -- own files.
    profile_id = auth.uid()
    or exists (
      select 1 from files
      where files.id = file_access_grants.file_id
        and files.uploader_id = auth.uid()
    )
  );

drop policy if exists file_access_grants_write on file_access_grants;
create policy file_access_grants_write on file_access_grants
  for all
  using (
    exists (
      select 1 from files
      where files.id = file_access_grants.file_id
        and (
          files.uploader_id = auth.uid()
          or exists (
            select 1 from profiles
            where id = auth.uid()
              and company_id = files.company_id
              and role in ('CEO', 'COO', 'admin')
          )
        )
    )
  );

-- ─── (3) file_classification_suggestions (A11 mirror audit) ─
-- Records what the AI proposed for each file. The user's
-- ACTUAL chosen classification lives on files itself; this
-- table preserves the SUGGESTION for the §3.5 readout that
-- measures DOWNSTREAM consequence (per A3 — never measure
-- adoption).
create table if not exists file_classification_suggestions (
  id                       uuid primary key default gen_random_uuid(),
  file_id                  uuid not null references files(id) on delete cascade,
  suggested_department_ids uuid[] not null default '{}',
  suggested_task_ids       uuid[] not null default '{}',
  suggested_title          text,
  suggested_description    text,
  suggested_tags           text[] not null default '{}',
  -- The state the user landed on AFTER seeing the suggestion.
  -- 'accepted_as_is'  = user clicked Save without editing
  -- 'edited_then_saved' = user changed one or more fields
  -- 'rejected'        = user changed every field
  -- 'pending'         = modal still open
  user_action              text not null default 'pending'
    check (user_action in ('accepted_as_is', 'edited_then_saved', 'rejected', 'pending')),
  user_acted_at            timestamptz,
  created_at               timestamptz not null default now()
);

create index if not exists file_suggestions_file_idx
  on file_classification_suggestions (file_id);

alter table file_classification_suggestions enable row level security;

-- Read: anyone who can see the file can see its suggestion
-- audit row (A10 — no shadow read).
drop policy if exists file_suggestions_select on file_classification_suggestions;
create policy file_suggestions_select on file_classification_suggestions
  for select
  using (
    exists (select 1 from files where files.id = file_classification_suggestions.file_id)
  );

-- Write: only the file's uploader or admins (and the service-
-- role client, which bypasses RLS — that's the AI suggester).
drop policy if exists file_suggestions_write on file_classification_suggestions;
create policy file_suggestions_write on file_classification_suggestions
  for all
  using (
    exists (
      select 1 from files
      where files.id = file_classification_suggestions.file_id
        and (
          files.uploader_id = auth.uid()
          or exists (
            select 1 from profiles
            where id = auth.uid()
              and company_id = files.company_id
              and role in ('CEO', 'COO', 'admin')
          )
        )
    )
  );

-- ─── (4) Casual-cap helper ──────────────────────────────────
-- Returns the count of casual uploads by THIS user TODAY (UTC).
-- The API layer calls this before allowing a casual upload to
-- finalize. Counter derived live; no separate counter table
-- (§A12 footgun avoidance — counters that can drift from the
-- underlying truth are bugs waiting to happen).
create or replace function count_user_casual_uploads_today(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from files
  where uploader_id = p_user_id
    and classification_lane = 'casual'
    and created_at >= date_trunc('day', now() at time zone 'UTC')
    and deprecated_at is null;
$$;

-- ─── (5) Event vocabulary extension ──────────────────────────
-- These event kinds extend the existing events table from
-- migration 0004. No schema change to events; just declaring
-- the new kinds in a documenting view so future engineers can
-- discover the vocabulary.
create or replace view asset_event_kinds as
  select kind, description from (values
    ('asset.file.uploaded',
     'A file row was created. Payload: file_id, uploader_id, size_bytes, mime_type, classification_lane.'),
    ('asset.file.classified',
     'A file moved from casual to classified (gate cleared). Payload: file_id, department_ids[], task_ids[], tags[].'),
    ('asset.file.viewed',
     'A user opened the file viewer. Distinct from downloaded — a view does not transfer bytes off-server.'),
    ('asset.file.downloaded',
     'A user downloaded the file bytes. Counts toward §4 retrieval-rate readout.'),
    ('asset.file.shared',
     '@person share: file was @-mentioned at a specific user. Payload: file_id, shared_with_profile_id, surface (chat/care).'),
    ('asset.file.cited',
     'File was @file-referenced in a chat/task/decision/resolution. Counts toward §4 citation-rate readout.'),
    ('asset.file.deprecated',
     'Uploader or admin marked the file deprecated. Soft-delete; the file row remains.'),
    ('asset.file.access_changed',
     'Access role was changed (e.g., everyone → admins). Payload: file_id, prev_role, new_role.'),
    ('asset.suggestion.acted_on',
     'User responded to an AI classification suggestion. Payload: file_id, user_action.')
  ) as t (kind, description);

comment on view asset_event_kinds is
  'Vocabulary of asset.* event kinds for the existing events
   table. Declared per ThinkerThinker A13 (vocabulary-once
   discipline) — every event kind belongs in a discoverable
   index so future agents can find the existing space before
   adding a new word.';

-- ─── (6) Supabase Storage bucket note ───────────────────────
-- Storage buckets are managed via the Supabase dashboard or
-- the storage.buckets table. The Asset System v1 bucket is
-- named `assets-v1` with:
--   • public = false (objects accessed via signed URLs)
--   • file_size_limit = 26214400 (25 MB)
--   • allowed_mime_types = images/* + application/pdf + common
--     office types (server enforces the agent vs customer
--     stricter cap and type list)
--
-- Phase 0 manual step (one-time after applying this migration):
-- In Supabase SQL editor run:
--   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
--   values ('assets-v1', 'assets-v1', false, 26214400, null)
--   on conflict (id) do nothing;
--
-- Object-level RLS policies on storage.objects for the
-- assets-v1 bucket are added in a Phase 1 follow-up once the
-- naming convention (companyId/year/month/fileId) is in code.

-- ─── End migration 0057. ────────────────────────────────────
