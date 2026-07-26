-- 0194_care_rcd.sql
--
-- RCD — Raw Conversation Data (founder build 2026-07-26).
--
-- WHAT. The complete, faithful record of a conversation the C.A.R.E browser
-- extension captured from a third-party channel (WhatsApp, Gmail, Zendesk, …):
-- every message's text + sender/role, AND its media (images/files/audio/video)
-- stored as BYTES in a private bucket. Surfaced at the bottom of the C.A.R.E app
-- (web + mobile) so the agent and the AI work from what the customer ACTUALLY
-- sent, not a lossy text-only scrape. Founder decision (2026-07-26): store bytes
-- (not references — captured URLs carry auth tokens / are session-scoped blob URLs
-- that die), rendered in the app.
--
-- DATA GOVERNANCE. This REVERSES the extension's prior "nothing stored" posture —
-- a deliberate, founder-approved change. Consequences handled here:
--   • Media is CUSTOMER PII (screenshots can hold IDs, cards, addresses). The bucket
--     is PRIVATE (public=false) — never a public URL; the app streams via a
--     tenant-checked serve route (Phase 4). Storage RLS scopes objects by company_id
--     as the first path segment, same pattern as widget-logos (0064).
--   • Tenant isolation: every table carries company_id; SELECT is gated to company
--     members; writes are service-role only (the extension ingest route scopes by the
--     authed agent's company_id in code, same as care_visitor_presence 0192).
--   • CONTENT-IMMUTABLE (§3.1): a captured record is never edited. An immutability
--     trigger freezes the content columns (mirrors care_knowledge_documents 0193 /
--     decision_dialogues 0003) while permitting captured_by -> NULL so GDPR user
--     erasure is never blocked. NOT a blanket append-only RULE (which would collide
--     with the on-delete-set-null cascade — the 5-table lesson from 0035).
--   • RETENTION: RCD is retention-bounded operational data, not a permanent thesis
--     record. A service-role time-based purge (by captured_at) removes old rows; the
--     captured_at indexes below support it. The purge cron is a follow-up (Phase 3b);
--     retention is therefore the ONLY delete path and it is service-role, never app.
--
-- Idempotent by construction (A12): create-if-not-exists, or-replace, drop-if-exists.

create extension if not exists pgcrypto;

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- One row per captured conversation snapshot.
create table if not exists care_rcd_conversations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  -- The channel the extension captured from (adapter key: 'whatsapp','gmail',…).
  channel       text not null,
  -- The page URL the capture came from (diagnostic / dedup aid). May be null.
  source_url    text,
  -- Optional channel-native thread id, if the adapter can resolve one (dedup/link).
  external_ref  text,
  message_count integer not null default 0,
  captured_by   uuid references profiles(id) on delete set null,
  captured_at   timestamptz not null default now()
);

create index if not exists care_rcd_conversations_company_idx
  on care_rcd_conversations (company_id, captured_at desc);

-- Messages within a captured conversation, in document order.
create table if not exists care_rcd_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references care_rcd_conversations(id) on delete cascade,
  -- Denormalized company_id so RLS + retention can scope without a join.
  company_id      uuid not null references companies(id) on delete cascade,
  seq             integer not null,
  -- Attribution carried AT THE SOURCE (A39) — never inferred downstream.
  role            text not null default 'unknown' check (role in ('agent', 'customer', 'unknown')),
  sender          text,
  body            text not null default '',
  captured_at     timestamptz not null default now(),
  unique (conversation_id, seq)
);

create index if not exists care_rcd_messages_conversation_idx
  on care_rcd_messages (conversation_id, seq);
create index if not exists care_rcd_messages_company_idx
  on care_rcd_messages (company_id, captured_at desc);

-- Media captured with a message. BYTES live in the private care-rcd-media bucket;
-- storage_path points at them. url is retained only as provenance (where it was
-- scraped from) and is NEVER served to a client (it can carry an auth token).
create table if not exists care_rcd_media (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references care_rcd_messages(id) on delete cascade,
  conversation_id uuid not null references care_rcd_conversations(id) on delete cascade,
  company_id      uuid not null references companies(id) on delete cascade,
  media_type      text not null check (media_type in ('image', 'file', 'video', 'audio')),
  -- Path within the care-rcd-media bucket: <company_id>/<conversation_id>/<media_id>.
  storage_path    text not null,
  filename        text,
  alt             text,
  content_type    text,
  byte_size       integer,
  -- Provenance only. Server-side, never returned to a browser (may contain a token).
  source_url      text,
  captured_at     timestamptz not null default now()
);

create index if not exists care_rcd_media_message_idx
  on care_rcd_media (message_id);
create index if not exists care_rcd_media_company_idx
  on care_rcd_media (company_id, captured_at desc);

-- ─── Content-immutability triggers (§3.1) ────────────────────────────────────
-- Freeze the captured content; permit only captured_by -> NULL (erasure cascade).

create or replace function check_care_rcd_conversation_immutability()
returns trigger language plpgsql as $$
begin
  if (NEW.company_id    is distinct from OLD.company_id)
     or (NEW.channel       is distinct from OLD.channel)
     or (NEW.source_url    is distinct from OLD.source_url)
     or (NEW.external_ref  is distinct from OLD.external_ref)
     or (NEW.message_count is distinct from OLD.message_count)
     or (NEW.captured_at   is distinct from OLD.captured_at)
  then
    raise exception 'care_rcd_conversations is a captured record — immutable (id=%)', OLD.id;
  end if;
  return NEW; -- only captured_by may change (to NULL, on user deletion)
end $$;

drop trigger if exists care_rcd_conversations_immutable on care_rcd_conversations;
create trigger care_rcd_conversations_immutable
  before update on care_rcd_conversations
  for each row execute function check_care_rcd_conversation_immutability();

create or replace function check_care_rcd_message_immutability()
returns trigger language plpgsql as $$
begin
  raise exception 'care_rcd_messages is a captured record — immutable (id=%)', OLD.id;
end $$;

drop trigger if exists care_rcd_messages_immutable on care_rcd_messages;
create trigger care_rcd_messages_immutable
  before update on care_rcd_messages
  for each row execute function check_care_rcd_message_immutability();

create or replace function check_care_rcd_media_immutability()
returns trigger language plpgsql as $$
begin
  raise exception 'care_rcd_media is a captured record — immutable (id=%)', OLD.id;
end $$;

drop trigger if exists care_rcd_media_immutable on care_rcd_media;
create trigger care_rcd_media_immutable
  before update on care_rcd_media
  for each row execute function check_care_rcd_media_immutability();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- SELECT: any member of the tenant reads their tenant's RCD (the app renders it).
-- INSERT/UPDATE/DELETE: NO policy by design — the extension ingest route writes via
-- the service-role client (scoping by the authed agent's company_id in code, same as
-- care_visitor_presence 0192), content is immutable (triggers above), and the only
-- delete path is a service-role retention purge. These deliberate omissions are
-- allowlisted in scripts/rls-audit.mjs with this reason.

alter table care_rcd_conversations enable row level security;
alter table care_rcd_messages enable row level security;
alter table care_rcd_media enable row level security;

drop policy if exists "care_rcd_conversations - select" on care_rcd_conversations;
create policy "care_rcd_conversations - select" on care_rcd_conversations
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = care_rcd_conversations.company_id
    )
  );

drop policy if exists "care_rcd_messages - select" on care_rcd_messages;
create policy "care_rcd_messages - select" on care_rcd_messages
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = care_rcd_messages.company_id
    )
  );

drop policy if exists "care_rcd_media - select" on care_rcd_media;
create policy "care_rcd_media - select" on care_rcd_media
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = care_rcd_media.company_id
    )
  );

-- ─── Private media bucket ────────────────────────────────────────────────────
-- PRIVATE (public=false): RCD media is customer PII and must never be a public URL.
-- The app streams it via a tenant-checked serve route (Phase 4). Storage RLS scopes
-- objects by company_id as the first path segment (same pattern as widget-logos 0064).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'care-rcd-media',
  'care-rcd-media',
  false,                    -- PRIVATE — customer PII, never a public URL
  26214400,                 -- 25 MB per object
  array[
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/heic',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4'
  ]
)
on conflict (id) do nothing;

-- Authenticated tenant members may READ objects in their own company's path. Writes
-- go through the service-role ingest route (bypasses storage RLS); no anon access.
drop policy if exists "care-rcd-media: authenticated SELECT own company path" on storage.objects;
create policy "care-rcd-media: authenticated SELECT own company path"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'care-rcd-media'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );

comment on table care_rcd_conversations is
  'RCD: extension-captured third-party conversation snapshots. Content-immutable (§3.1), tenant-scoped, retention-purged by a service-role cron. 0194.';
comment on table care_rcd_media is
  'RCD media BYTES metadata; bytes in the private care-rcd-media bucket. source_url is provenance-only, never served to a client. 0194.';

-- ─── End migration 0194. ─────────────────────────────────────────────────────
