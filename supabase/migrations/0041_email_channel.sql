-- 0041 — Email channel ingestion.
--
-- Phase 4 commit 1 of the post-CAT-001 rebuild. Adds the schema
-- to ingest inbound email and thread agent replies back to the
-- same email conversation. Constitutional sources:
--   - §3.1 — every inbound email lands as an immutable append-
--     only event, same shape as widget messages. Identity
--     (external_message_id) makes the §3.1 chain dedup-safe
--     across provider retries.
--   - §A16 — composition from day one. The grader + Co-Pilot
--     are the same surfaces that grade/draft widget replies;
--     email replies grade and compose identically.
--   - §A12 — every column add is idempotent; every index uses
--     IF NOT EXISTS.
--   - §A4 — provider choice (Postmark / SES / SendGrid) is an
--     uncertainty deferred to the §4 readout. The schema is
--     provider-agnostic (we store the provider's message-id
--     verbatim; threading uses In-Reply-To / References
--     standard headers).
--
-- What this migration does NOT add yet
-- ────────────────────────────────────
--   - Attachment storage. Email attachments are valuable but
--     introduce a Supabase Storage dependency + virus-scan
--     question. Deferred per §A4 to a follow-up migration once
--     the §4 readout shows the email channel is producing
--     enough traffic to justify it.
--   - DKIM / SPF / DMARC verification at ingestion. We log the
--     header values in the message metadata (jsonb) so the §4
--     readout can detect spoofing attempts retrospectively;
--     blocking-at-ingestion lands later once we have evidence
--     it's needed.

-- ─── care_tenant_config — inbound email local part ───────────
alter table care_tenant_config
  add column if not exists inbound_email_local_part text;

-- Unique partial index — two tenants can't share an inbound
-- local part. NULL allowed (tenants without email channel set up
-- yet have NULL until the settings UI auto-generates one).
create unique index if not exists care_tenant_config_inbound_email_idx
  on care_tenant_config (inbound_email_local_part)
  where inbound_email_local_part is not null;

-- ─── support_conversations — threading id for email ──────────
-- The external_thread_id is the In-Reply-To / References value
-- from the original email. Inbound webhook resolves replies to
-- existing conversations by looking up this id. NULL for non-
-- email conversations.
alter table support_conversations
  add column if not exists external_thread_id text;

create index if not exists support_conversations_external_thread_idx
  on support_conversations (external_thread_id)
  where external_thread_id is not null;

-- ─── support_messages — provider message id (dedup) ──────────
-- Webhook retries are normal for any email provider. The
-- external_message_id makes the dedup §3.1-honest: re-posting
-- the same provider message is a no-op, not a duplicate event.
alter table support_messages
  add column if not exists external_message_id text;

create unique index if not exists support_messages_external_message_idx
  on support_messages (external_message_id)
  where external_message_id is not null;

-- ─── Email metadata column on support_messages ────────────────
-- Jsonb for provider-specific headers (From, Subject, Date,
-- DKIM result, etc.) without forcing a column per header. Per
-- §A4 the exact set of headers we'll want for the §4 readout is
-- itself an uncertainty — surface the raw shape and refine.
alter table support_messages
  add column if not exists email_metadata jsonb;

-- ─── Preserve trigger refresh for new email columns ──────────
-- The 0037 + 0040 preserve_support_message_content trigger
-- reverts updates to author/content columns. Email-related
-- columns (external_message_id, email_metadata) are set on
-- INSERT and never updated, so they need the same revert
-- treatment.
create or replace function preserve_support_message_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.body := old.body;
  new.author_id := old.author_id;
  new.author_type := old.author_type;
  new.is_internal_note := old.is_internal_note;
  new.conversation_id := old.conversation_id;
  new.created_at := old.created_at;
  new.co_pilot_reasoning := old.co_pilot_reasoning;
  new.co_pilot_invoked := old.co_pilot_invoked;
  -- Email columns — set on INSERT, immutable after.
  new.external_message_id := old.external_message_id;
  new.email_metadata := old.email_metadata;
  return new;
end;
$$;

-- ─── Backfill ELOSTATE tenant's local part ────────────────────
-- Derived from the first 16 chars of embed_token (already
-- unique). Idempotent — only sets if currently NULL.
update care_tenant_config
   set inbound_email_local_part = 't-' || substring(embed_token, 1, 16)
 where inbound_email_local_part is null
   and embed_token is not null;

-- ─── Auto-generate on insert for future tenants ──────────────
create or replace function auto_set_inbound_email_local_part()
returns trigger
language plpgsql
as $$
begin
  if new.inbound_email_local_part is null and new.embed_token is not null then
    new.inbound_email_local_part := 't-' || substring(new.embed_token, 1, 16);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_inbound_email on care_tenant_config;
create trigger trg_auto_inbound_email
  before insert on care_tenant_config
  for each row execute function auto_set_inbound_email_local_part();

-- ─── Comments ────────────────────────────────────────────────
comment on column care_tenant_config.inbound_email_local_part is
  'The local part (before @) of the tenant''s unique inbound
   email address. Full address is built at runtime as
   <local_part>@<email-host-domain> where email-host-domain is
   the deployment-level config (e.g. care.elostate.com).
   Tenants forward their support@theircompany.com to this
   address; inbound webhook resolves the tenant from it. Auto-
   generated from the first 16 chars of embed_token on first
   insert.';

comment on column support_conversations.external_thread_id is
  'For email conversations: the In-Reply-To / References value
   from the original email so inbound replies can be threaded
   back. NULL for non-email conversations (web widget,
   embedded widget). When set, we look this up before creating
   a new conversation for the same thread.';

comment on column support_messages.external_message_id is
  'Provider-assigned message id (e.g. Postmark MessageID). Makes
   webhook retry dedup §3.1-honest: re-posting the same provider
   message is a no-op. NULL for non-email messages.';

comment on column support_messages.email_metadata is
  'Provider-specific email headers (From, Subject, Date, DKIM
   result, etc.) preserved verbatim. Lets the §4 readout reason
   about delivery / spoofing patterns retrospectively without
   forcing a column per header up front.';
