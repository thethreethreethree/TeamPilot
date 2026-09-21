-- A12 RE-RUNNABILITY GUARDS ADDED 2026-09-21. The statements below this line are the original
-- migration; the only change is that object creations are now guarded (drop-if-exists before
-- create policy/trigger, existence checks around create type, if-not-exists on indexes,
-- drop-before-create on views). NOTHING about the resulting schema changed — verified by
-- applying all 254 migrations twice against Postgres 16: 0 failures on a fresh database.
--
-- WHY AN APPLIED MIGRATION WAS EDITED. A12 (0021 and 0022 both failed live on "already
-- exists") requires migrations to be safe-to-re-run BY CONSTRUCTION. 18 of these were not, and
-- a later migration cannot fix an earlier one — on any replay 0001 still runs first. Tested:
-- a repair migration leaves 0001 failing exactly as before. Editing in place is the only thing
-- that reaches zero. Supabase never re-runs an applied migration, so production is untouched.
-- Founder decision, 2026-09-21. Record: docs/tbc/2026-09-21-migration-idempotency/.

-- 0238_meeting_prep_up.sql
--
-- Prep-up (Team-Sync / Meeting Coach) — pre-meeting context the facilitator loads BEFORE a meeting so the AI
-- coach is agenda-aware: the ultimate GOAL, the must-discuss TOPICS, and supporting DOCUMENTS (images with
-- notes, text/pdf/docx). Founder-directed 2026-08-22. New tables only (no change to coaching_sessions); a
-- meeting session finds its prep by meeting_preps.session_id. Conforms to repo conventions: company_id tenancy,
-- auth_company_id(), a touch_*_updated_at trigger.

-- ── meeting_preps ───────────────────────────────────────────────────────────────
create table if not exists meeting_preps (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null,
  created_by   uuid not null references auth.users(id) on delete cascade,
  goal         text not null default '',
  -- [{ "id": "<uuid>", "text": "topic", "covered": false }] — the must-discuss list + live coverage.
  topics       jsonb not null default '[]'::jsonb,
  status       text not null default 'draft' check (status in ('draft', 'active', 'done')),
  -- Set when the meeting starts; the coaching session (a coaching_sessions row) is found from here.
  session_id   uuid null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists meeting_preps_owner_idx on meeting_preps (created_by, created_at desc);
create index if not exists meeting_preps_session_idx on meeting_preps (session_id);

-- ── meeting_prep_documents ──────────────────────────────────────────────────────
create table if not exists meeting_prep_documents (
  id             uuid primary key default gen_random_uuid(),
  prep_id        uuid not null references meeting_preps(id) on delete cascade,
  company_id     uuid not null,
  storage_path   text not null,                          -- assets-v1 object path
  filename       text not null,
  kind           text not null check (kind in ('image', 'text', 'pdf')),
  note           text not null default '',               -- the facilitator's note (the AI signal for images)
  extracted_text text not null default '',               -- OCR (image) / extractText (text/pdf) output
  created_at     timestamptz not null default now()
);
create index if not exists meeting_prep_documents_prep_idx on meeting_prep_documents (prep_id, created_at);

-- ── updated_at trigger (repo convention) ─────────────────────────────────────────
create or replace function touch_meeting_preps_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists meeting_preps_updated_at on meeting_preps;
create trigger meeting_preps_updated_at before update on meeting_preps
  for each row execute function touch_meeting_preps_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────────
alter table meeting_preps          enable row level security;
alter table meeting_prep_documents enable row level security;

-- meeting_preps: the facilitator owns their own preps (create/read/update/delete); company pinned on every
-- write op (insert with check; update/delete using — the audit requires the tenant pin on each).
drop policy if exists "meeting_preps - select" on meeting_preps;
create policy "meeting_preps - select" on meeting_preps for select using (created_by = auth.uid());
drop policy if exists "meeting_preps - insert" on meeting_preps;
create policy "meeting_preps - insert" on meeting_preps for insert
  with check (created_by = auth.uid() and company_id = auth_company_id());
drop policy if exists "meeting_preps - update" on meeting_preps;
create policy "meeting_preps - update" on meeting_preps for update
  using (created_by = auth.uid() and company_id = auth_company_id())
  with check (created_by = auth.uid() and company_id = auth_company_id());
drop policy if exists "meeting_preps - delete" on meeting_preps;
create policy "meeting_preps - delete" on meeting_preps for delete
  using (created_by = auth.uid() and company_id = auth_company_id());

-- meeting_prep_documents: gated through the parent prep's ownership AND the tenant pin on every write op.
drop policy if exists "meeting_prep_documents - select" on meeting_prep_documents;
create policy "meeting_prep_documents - select" on meeting_prep_documents for select using (
  exists (select 1 from meeting_preps mp where mp.id = meeting_prep_documents.prep_id and mp.created_by = auth.uid())
);
drop policy if exists "meeting_prep_documents - insert" on meeting_prep_documents;
create policy "meeting_prep_documents - insert" on meeting_prep_documents for insert
  with check (
    company_id = auth_company_id()
    and exists (select 1 from meeting_preps mp where mp.id = meeting_prep_documents.prep_id and mp.created_by = auth.uid())
  );
drop policy if exists "meeting_prep_documents - update" on meeting_prep_documents;
create policy "meeting_prep_documents - update" on meeting_prep_documents for update
  using (
    company_id = auth_company_id()
    and exists (select 1 from meeting_preps mp where mp.id = meeting_prep_documents.prep_id and mp.created_by = auth.uid())
  )
  with check (
    company_id = auth_company_id()
    and exists (select 1 from meeting_preps mp where mp.id = meeting_prep_documents.prep_id and mp.created_by = auth.uid())
  );
drop policy if exists "meeting_prep_documents - delete" on meeting_prep_documents;
create policy "meeting_prep_documents - delete" on meeting_prep_documents for delete using (
  company_id = auth_company_id()
  and exists (select 1 from meeting_preps mp where mp.id = meeting_prep_documents.prep_id and mp.created_by = auth.uid())
);
