-- 0212 — Sales Coach: ATOMIC transcript replace (delete + re-insert in one transaction).
--
-- BUG (adversarial review of the 2026-08-14 auto-recover build): the recovery overwrite is a delete-then-append
-- across two non-transactional service-role calls. The delete result is checked, but the append loop swallows
-- DB errors (appendTranscriptSegment returns null, non-throwing). So a transient DB error AFTER a successful
-- delete can destroy the original transcript and save nothing (or a partial), while the route still reports
-- "recovered". For /auto-recover this deletes a CUSTOMER-MISSING transcript that holds REAL, live-captured agent
-- speech (a §3.1 data asset) — worse than the /label-transcript case, which only deletes a 0-agent broken one.
-- A partial re-append that lands an agent turn also LOCKS the session (looks canonical → 409 on every retry).
--
-- FIX (root, founder-approved): a single function that DELETEs the session's segments then INSERTs the new set
-- in ONE transaction (a plpgsql function body is atomic to its calling statement). On any error the whole thing
-- rolls back — the original transcript is NEVER left destroyed-and-unreplaced. Both /auto-recover and
-- /label-transcript's overwrite branch call it, fixing the class at the root.
--
-- SECURITY: SECURITY DEFINER with a pinned search_path (matches the codebase convention). It takes a session_id
-- tenant param, so it must NOT be client-callable — execute is granted to service_role ONLY (the routes call it
-- via the service-role client, AFTER their own owner + caveat gating). anon/authenticated cannot invoke it, so
-- it is not a client-callable DEFINER tenant-param function (the invariant guard).
--
-- Idempotent: create-or-replace + re-asserted grants. Safe to run twice.

create or replace function replace_session_transcript(
  p_session_id uuid,
  p_segments jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Atomic: if the insert fails for any reason, the delete rolls back with it (the original stands).
  delete from coaching_transcript_segments where session_id = p_session_id;

  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at)
  select
    p_session_id,
    (e->>'speaker'),
    (e->>'text'),
    (e->>'seq')::integer,
    null
  from jsonb_array_elements(p_segments) as e;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Server-only mechanism: never client-callable (it takes a tenant id and writes the canonical transcript).
revoke all on function replace_session_transcript(uuid, jsonb) from public;
revoke execute on function replace_session_transcript(uuid, jsonb) from anon, authenticated;
grant execute on function replace_session_transcript(uuid, jsonb) to service_role;

comment on function replace_session_transcript(uuid, jsonb) is
  'Sales Coach (0212): atomically replace a session''s transcript (delete all + insert p_segments) in one '
  'transaction, so a mid-write failure never leaves the original destroyed-and-unreplaced. Service-role only; '
  'callers (auto-recover, label-transcript overwrite) gate owner + one-sided precondition before invoking.';
