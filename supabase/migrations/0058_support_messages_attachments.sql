-- 0058 — support_messages gains kind + media_url + media_type
-- so C.A.R.E file uploads render inline in the conversation
-- thread, same shape as chat_messages.
--
-- Constitutional source (§0.1):
--   • CLAUDE.md §1.5 (holistic) — chat_messages already
--     supports kind='attachment' + media_url + media_type
--     (migration 0010). support_messages did not. Files
--     uploaded from the C.A.R.E composer landed in the files
--     table but the agent thread had no inline render — the
--     agent had to navigate to the library to confirm what
--     they (or the customer) just attached. That's a layer-3
--     composition gap.
--   • §A14 (data path ≠ render path) — the file row existed,
--     the link to the conversation existed, but the render
--     path didn't consume them. This migration closes that.
--   • §A12 — idempotent (every CREATE IF NOT EXISTS).
--
-- After this migration:
--   - Agent uploads from /dashboard/care composer → file row +
--     a support_messages row with kind='attachment' and
--     media_url='assets-v1://{fileId}'
--   - Customer uploads from widget → same shape, kind='attachment'
--     posted under author_type='customer'
--   - The thread render branches on kind to show an attachment
--     card with title + size + signed download URL.

-- ─── (1) Add the columns ─────────────────────────────────────
alter table support_messages
  add column if not exists kind text not null default 'message'
    check (kind in ('message', 'attachment', 'system'));

alter table support_messages
  add column if not exists media_url text;

alter table support_messages
  add column if not exists media_type text;

-- ─── (2) Preserve-immutable trigger refresh ──────────────────
-- Same shape as 0043's voice update — kind / media_url /
-- media_type are set on INSERT and never updated. Add them to
-- the existing preserve trigger.
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
  new.external_message_id := old.external_message_id;
  new.email_metadata := old.email_metadata;
  new.medium := old.medium;
  -- 0058: kind / media_url / media_type are also immutable
  -- once a message is posted. An attachment message can't be
  -- mutated into a plain message; that would silently break
  -- the §3.1 chain.
  new.kind := old.kind;
  new.media_url := old.media_url;
  new.media_type := old.media_type;
  return new;
end;
$$;

-- ─── (3) Comments ────────────────────────────────────────────
comment on column support_messages.kind is
  'Message kind. 0058 added (''message'', ''attachment'',
   ''system''). Default ''message''. Attachment messages carry
   the file pointer in media_url (assets-v1://{fileId}) and
   the MIME type in media_type for icon selection.';

comment on column support_messages.media_url is
  'For attachment-kind messages: assets-v1://{fileId}. The
   render path resolves the file row + signed download URL on
   demand. Per §3.1 immutable once set.';

-- ─── End migration 0058. ────────────────────────────────────
