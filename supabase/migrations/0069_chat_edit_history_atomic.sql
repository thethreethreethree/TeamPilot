-- 0069 — Make the chat-edit history event ATOMIC + guard empty edits.
--
-- Remediation of the 2026-06-26 audit of migration 0068 (queue #8):
--   • F1 (HIGH, §3.1): the edit-history event was emitted app-side as
--     a fire-and-forget `void supabase.from('events').insert(...)` —
--     not awaited, in a SEPARATE statement from the body update. §3.1
--     requires history "always intact." A transient failure could
--     mutate the body while losing the prior-version event. 0068's own
--     header claimed the guarantee held; it did not. Fix: emit the
--     event from an AFTER-UPDATE trigger in the SAME transaction as the
--     update. Now the edit and its history row commit together or not
--     at all — history is recorded iff the body changed (true §3.1
--     atomicity). The app-side void insert is removed in the same
--     change set (src/lib/data/chats.ts) so the event is not
--     double-emitted.
--   • F5 (LOW): the 0068 guard let an edit blank a message body at the
--     DB (only the app enforced non-empty). Fix: the existing
--     BEFORE-UPDATE guard now rejects an empty body for kind='message'
--     edits — a trigger-level guard (NOT a table CHECK, which would
--     also hit legitimately-null system/summary bodies).
--
-- Constitutional sources (§0.1, read this session):
--   • §3.1 — history now atomic with the mutation it records.
--   • §2 — the guard stays minimal/tight (only blocks empty message
--     edits; does not touch other kinds).
--   • §A12 — CREATE OR REPLACE / DROP IF EXISTS; replayable.
--   • §A5 — verified: the only writer of chat_messages updates is
--     editMessage; the existing emit/touch triggers are AFTER INSERT
--     only, so this AFTER UPDATE trigger composes without overlap.

-- ─── (1) F5 — extend the BEFORE-UPDATE guard to block empty edits ──
-- (Re-states 0068's guard verbatim and adds the empty-body check, so
--  the function remains the single source of edit-time invariants.)
create or replace function chat_messages_guard_edit()
returns trigger language plpgsql security invoker as $$
begin
  -- Lock every immutable column. Only the body may change on an edit.
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
  -- F5: an edited text message cannot be blanked. (Only message-kind
  -- rows are editable via RLS; other kinds may legitimately be null.)
  if NEW.kind = 'message'
     and (NEW.body is null or length(btrim(NEW.body)) = 0) then
    raise exception 'chat_messages: an edited message cannot be empty';
  end if;
  -- Preserve the first version exactly once; never overwrite it.
  if OLD.original_body is null then
    NEW.original_body := OLD.body;
  else
    NEW.original_body := OLD.original_body;
  end if;
  -- Stamp the edit time server-side.
  NEW.edited_at := now();
  return NEW;
end $$;
-- (trigger chat_messages_guard_edit_trg from 0068 already points here.)

-- ─── (2) F1 — atomic edit-history event via AFTER-UPDATE trigger ──
-- security invoker so the insert runs under the editor's JWT: RLS on
-- events ("company_id = auth_company_id()") is satisfied because
-- NEW.company_id is the editor's company, and auth.uid() resolves to
-- the editor for `actor`. If this insert were ever denied, the whole
-- update rolls back — which is the correct §3.1 outcome (no silent
-- mutate-without-history).
create or replace function chat_messages_emit_edit_event()
returns trigger language plpgsql security invoker as $$
begin
  if NEW.body is distinct from OLD.body then
    insert into events (company_id, actor, kind, subject, payload)
    values (
      NEW.company_id,
      auth.uid(),
      'chat.message.edited',
      'chat_message:' || NEW.id,
      jsonb_build_object(
        'topic_id',   NEW.topic_id,
        'prior_body', OLD.body,
        'new_body',   NEW.body
      )
    );
  end if;
  return NEW;
end $$;

drop trigger if exists chat_messages_emit_edit_event_trg on chat_messages;
create trigger chat_messages_emit_edit_event_trg
  after update on chat_messages
  for each row execute function chat_messages_emit_edit_event();

-- ─── End migration 0069. ────────────────────────────────────
