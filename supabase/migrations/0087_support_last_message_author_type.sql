-- 0087_support_last_message_author_type.sql
--
-- Add last_message_author_type to support_conversations so the agent inbox can
-- tell, per row, whether the most recent message was from the CUSTOMER — the
-- reliable signal an inbox-wide "new customer message" chime needs (today the
-- inbox row carries only last_message_at, which advances on AI/agent messages
-- too, so an inbox-level chime would false-fire).
--
-- APPROACH. A denormalized column stamped by the SAME trigger that already
-- stamps last_message_at (0034 stamp_support_conversation_timestamps) — the
-- trigger already reads new.author_type for first_response_at, so this is a
-- one-line addition. create-or-replace updates the function in place; the
-- existing trigger binding (trg_stamp_support_conversation) is unchanged.
--
-- SAFE / additive: nullable column (existing rows null until a new message or
-- the backfill below); the trigger change only WRITES one more column. No RLS
-- change. Idempotent (§A12): add-column-if-not-exists + create-or-replace.

alter table support_conversations
  add column if not exists last_message_author_type text;

create or replace function stamp_support_conversation_timestamps()
returns trigger
language plpgsql
as $$
declare
  v_now timestamptz := now();
begin
  update support_conversations c
    set last_message_at = v_now,
        last_message_author_type = new.author_type,
        first_message_at = coalesce(c.first_message_at, v_now),
        first_response_at = case
          when new.author_type = 'customer' then c.first_response_at
          else coalesce(c.first_response_at, v_now)
        end
  where c.id = new.conversation_id;
  return new;
end;
$$;

-- One-time backfill: set each existing conversation's last_message_author_type
-- from its most recent message, so the column is correct for rows that predate
-- this migration (not just newly-active ones).
update support_conversations c
  set last_message_author_type = m.author_type
  from (
    select distinct on (conversation_id) conversation_id, author_type
    from support_messages
    order by conversation_id, created_at desc
  ) m
  where m.conversation_id = c.id
    and c.last_message_author_type is null;
