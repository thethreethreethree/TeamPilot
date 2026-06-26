-- 0068 — Team Chat message editing (deferred queue #8).
--
-- Founder spec: the SENDER (only — not admins) may edit their own
-- message within 30 MINUTES of original send. An edited message shows
-- an always-visible inline "(edited)" label. Full history is preserved
-- append-only. No edit notifications; the 30-min clock does not reset
-- on replies/quotes.
--
-- §3.1 conflict + founder decision (on the record):
-- chat_messages was hard-locked append-only by the
-- `chat_messages_no_update` rule (`do instead nothing`), with the
-- stated §3.1 rationale that conversation history is the immutable
-- diagnostic record. Message editing requires mutating the row, which
-- that rule forbids. Per §2 (interrogate locked doors) the agent
-- surfaced the conflict and the FOUNDER chose to relax the rule
-- (2026-06-26) rather than model edits append-only. This migration
-- relaxes it in the MINIMAL, constrained way — not a wide-open
-- unlock:
--   • the row becomes mutable ONLY for body (+ the edit bookkeeping
--     columns); a trigger raises on any other column change.
--   • RLS allows the update ONLY for the sender, ONLY while the
--     message is < 30 minutes old, ONLY for kind='message'.
--   • original_body preserves the FIRST version forever; every edit
--     also emits an append-only chat.message.edited event carrying
--     the prior body (done at the app layer). So §3.1's deeper
--     guarantee — "full history must always be intact" — survives
--     even though the row is now mutable.
-- DELETE stays fully blocked (chat_messages_no_delete is untouched);
-- only editing was requested.
--
-- §A5 ripple-trace (verified before authoring): no application code
-- updates chat_messages (pinning uses the separate chat_pins table),
-- so relaxing the update lock affects nothing but the new edit path.
--
-- Constitutional sources (§0.1, read this session):
--   • §3.1 — relaxed by explicit founder decision; history preserved
--     via original_body + the append-only edit event.
--   • §2 — minimal constrained relaxation, not lock-picking; the
--     constraint's intent (history intact) is kept.
--   • §A12 — ADD COLUMN IF NOT EXISTS / DROP ... IF EXISTS / CREATE OR
--     REPLACE; replayable.
--   • §A10 + §A18 — the "(edited)" label is mandatory + always shown
--     (no shadow read; the label is the honest disclosure).

-- ─── (1) Edit bookkeeping columns ────────────────────────────
alter table chat_messages
  add column if not exists edited_at timestamptz;
alter table chat_messages
  add column if not exists original_body text;

comment on column chat_messages.edited_at is
  '0068: when the message was last edited (null = never edited). Drives
   the always-visible (edited) label per §A10/§A18.';
comment on column chat_messages.original_body is
  '0068: the FIRST version of the body, preserved on first edit and
   never overwritten (§3.1 history-intact). Intermediate versions live
   in the append-only chat.message.edited events.';

-- ─── (2) Relax the append-only update lock ───────────────────
-- (DELETE lock stays — chat_messages_no_delete is intentionally NOT
--  dropped; only editing was requested.)
drop rule if exists chat_messages_no_update on chat_messages;

-- ─── (3) Guard trigger — only body is editable, history kept ──
create or replace function chat_messages_guard_edit()
returns trigger language plpgsql security invoker as $$
begin
  -- Lock every immutable column. Only body / edited_at / original_body
  -- may change on an edit. Anything else is a bug or an attack.
  if NEW.topic_id      is distinct from OLD.topic_id
   or NEW.company_id   is distinct from OLD.company_id
   or NEW.author_id    is distinct from OLD.author_id
   or NEW.kind         is distinct from OLD.kind
   or NEW.media_url    is distinct from OLD.media_url
   or NEW.media_type   is distinct from OLD.media_type
   or NEW.reply_to_id  is distinct from OLD.reply_to_id
   or NEW.created_at   is distinct from OLD.created_at then
    raise exception 'chat_messages: only the message body is editable';
  end if;
  -- Preserve the first version exactly once; never overwrite it.
  if OLD.original_body is null then
    NEW.original_body := OLD.body;
  else
    NEW.original_body := OLD.original_body;
  end if;
  -- Stamp the edit time server-side (clients cannot forge it).
  NEW.edited_at := now();
  return NEW;
end $$;

drop trigger if exists chat_messages_guard_edit_trg on chat_messages;
create trigger chat_messages_guard_edit_trg
  before update on chat_messages
  for each row execute function chat_messages_guard_edit();

-- ─── (4) RLS — sender-only, 30-minute window ─────────────────
-- The browser client performs the edit under the user's JWT, so RLS
-- is the real gate. Sender-only + 30-min + message-kind, all enforced
-- here at the database (defense in depth; the app also pre-checks for
-- a friendly error). USING gates which rows may be updated; WITH CHECK
-- ensures the row still belongs to the sender after the update.
drop policy if exists "chat_messages - update own recent" on chat_messages;
create policy "chat_messages - update own recent" on chat_messages
  for update
  using (
    author_id = auth.uid()
    and kind = 'message'
    and created_at > now() - interval '30 minutes'
  )
  with check (
    author_id = auth.uid()
    and kind = 'message'
  );

-- ─── End migration 0068. ────────────────────────────────────
