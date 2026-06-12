-- 0027 — Atomic in-thread Decision Dialogue finalization
--
-- Closes §1.7 audit finding M1 (2026-06-12).
--
-- The audit identified that POST /api/chat/topic-decisions/[id]/decide
-- performs FIVE sequential writes (decisions / decision_dialogues /
-- chat_topic_decisions / chat_messages / events) without a transaction
-- boundary. Any failure between writes 2–5 leaves the database in a
-- partial state:
--
--   - decisions row exists but no decision_dialogues → broken
--     Decision Memory display + missing §3.1 dialogue record
--   - decisions + dialogue exist but chat_topic_decisions still
--     reads phase='decide' → user sees their dialogue as stuck
--     mid-flow even though the decision was persisted
--   - all three core writes succeed but the system message fails →
--     the topic thread has no record of the decision
--   - first four succeed but the chain event fails → §3.1 readout
--     misses the decision entirely (worst case for §3.4 metrics)
--
-- This migration introduces a SECURITY INVOKER plpgsql function that
-- performs all five writes inside a single implicit transaction.
-- SECURITY INVOKER keeps the caller's auth context so RLS still
-- applies to every write — no privilege elevation. If ANY write
-- fails (RLS denial, FK violation, anything), the entire function
-- raises and the transaction rolls back. The API route then becomes
-- a single rpc() call.
--
-- A12 discipline: CREATE OR REPLACE FUNCTION is idempotent by
-- construction. Re-running this migration is a clean no-op
-- regardless of prior state.

create or replace function decide_chat_topic_decision(
  p_topic_decision_id uuid,
  p_chosen_path       text,
  p_chosen_note       text
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_row             chat_topic_decisions%rowtype;
  v_decision_id     uuid;
  v_decided_at      timestamptz := now();
  v_actor           uuid := auth.uid();
  v_title           text;
  v_outcome         text;
  v_system_response jsonb;
  v_path_label      text;
  v_updated_row     chat_topic_decisions%rowtype;
begin
  if v_actor is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- ─── Load + validate the dialogue row ──────────────────────
  select * into v_row from chat_topic_decisions where id = p_topic_decision_id;
  if v_row.id is null then
    raise exception 'Dialogue not found' using errcode = 'P0002';
  end if;
  if v_row.phase = 'decided' then
    raise exception 'Dialogue already decided' using errcode = 'P0001';
  end if;
  if v_row.system_response is null then
    raise exception 'Cannot decide before the System has responded'
      using errcode = 'P0001';
  end if;
  if p_chosen_path not in ('user', 'system', 'hybrid', 'defer') then
    raise exception 'Invalid chosen_path: %', p_chosen_path
      using errcode = '22023';
  end if;

  v_system_response := v_row.system_response;

  -- ─── Compute title + outcome (mirror the API route logic) ──
  v_title := coalesce(
    nullif(left(split_part(coalesce(v_row.user_proposal, ''), E'\n', 1), 80), ''),
    'Decision'
  );

  v_outcome := case
    when p_chosen_path = 'defer' then 'Deferred — understanding not yet earned'
    else coalesce(
      nullif(p_chosen_note, ''),
      case
        when p_chosen_path = 'system'
          then v_system_response->'suggestion'->>'action'
        else v_row.user_proposal
      end,
      ''
    )
  end;

  -- ─── Write 1: decisions ────────────────────────────────────
  insert into decisions (
    company_id, title, situation, outcome, execution_status, options
  )
  values (
    v_row.company_id,
    v_title,
    v_row.situation,
    v_outcome,
    case when p_chosen_path = 'defer' then 'Deferred' else 'In Progress' end,
    v_system_response
  )
  returning id into v_decision_id;

  -- ─── Write 2: decision_dialogues ───────────────────────────
  insert into decision_dialogues (
    company_id, decision_id, situation, user_diagnosis, user_proposal,
    system_engagement, system_added_perspective, system_suggestion_action,
    system_suggestion_why, system_comparison, chosen_path, chosen_note,
    created_by, decided_at
  )
  values (
    v_row.company_id,
    v_decision_id,
    coalesce(v_row.situation, ''),
    coalesce(v_row.user_diagnosis, ''),
    coalesce(v_row.user_proposal, ''),
    v_system_response->>'engagement',
    v_system_response->>'addedPerspective',
    v_system_response->'suggestion'->>'action',
    v_system_response->'suggestion'->>'why',
    v_system_response->>'comparison',
    p_chosen_path,
    nullif(p_chosen_note, ''),
    v_actor,
    v_decided_at
  );

  -- ─── Write 3: chat_topic_decisions update ──────────────────
  update chat_topic_decisions
     set phase                 = 'decided',
         chosen_path           = p_chosen_path,
         chosen_note           = nullif(p_chosen_note, ''),
         decided_at            = v_decided_at,
         persisted_decision_id = v_decision_id
   where id = p_topic_decision_id
   returning * into v_updated_row;

  -- ─── Write 4: system message into the thread ───────────────
  -- A14 discipline: match the prior route's exact visible output —
  -- straight apostrophe in "System's" (the old route used U+0027) and
  -- the trailing period after the path label. The migration is the
  -- new data path; the rendered message in the topic timeline is the
  -- render path. Any drift between the two reads as "the decide flow
  -- changed slightly" to a user re-opening an old thread alongside a
  -- new one.
  v_path_label := case p_chosen_path
    when 'user'   then 'Going with my proposal'
    when 'system' then 'Going with the System''s suggestion'
    when 'hybrid' then 'Hybrid'
    when 'defer'  then 'Deferred — understanding not yet earned'
  end;

  insert into chat_messages (
    topic_id, company_id, author_id, kind, body
  )
  values (
    v_row.topic_id,
    v_row.company_id,
    v_actor,
    'system',
    'Decision recorded: ' || v_path_label || '.' ||
      case
        when nullif(p_chosen_note, '') is not null
          then E'\n\n' || p_chosen_note
        else ''
      end
  );

  -- ─── Write 5: §3.1 chain event ─────────────────────────────
  insert into events (
    company_id, actor, kind, subject, payload
  )
  values (
    v_row.company_id,
    v_actor,
    'decision.decided',
    'chat_topic:' || v_row.topic_id::text,
    jsonb_build_object(
      'decision_id',           v_row.id,
      'persisted_decision_id', v_decision_id,
      'chosen_path',           p_chosen_path,
      'mode',                  'in_thread'
    )
  );

  -- All five writes succeeded inside the implicit transaction. Return
  -- the updated chat_topic_decisions row as jsonb so the API route
  -- can hand it straight back to the client.
  return to_jsonb(v_updated_row);
end;
$$;

comment on function decide_chat_topic_decision(uuid, text, text) is
  'Atomic in-thread Decision Dialogue finalization. Closes audit M1
   (2026-06-12). Performs the five canonical decide writes (decisions
   + decision_dialogues + chat_topic_decisions update + system message
   + chain event) inside one transaction. SECURITY INVOKER keeps
   caller auth, so RLS still applies per write — any RLS denial
   rolls back the whole transaction.';
