-- 0249 — replace_session_transcript carries spoken_at
--
-- WHY. The pace ("speed") skill reads coaching_transcript_segments.spoken_at and needs at
-- least three timed agent turns. Live sessions stamp it from the browser as each utterance
-- is captured; an UPLOADED recording never did, so every uploaded call — from the web and
-- from the native app — has had a permanently blank pace skill.
--
-- The timing was never missing: the diarizer already returns a per-segment offset into the
-- audio. It was dropped on the way back to the client (0249's companion change carries it),
-- and this function was the last place it could not land: 0212 selected a literal `null`
-- into spoken_at, so the RECOVERY re-transcribe path threw the timing away even once the
-- rest of the chain carried it.
--
-- Idempotent by construction: create-or-replace plus re-asserted grants, exactly as 0212.
-- Safe to run twice, and safe to run against a database where 0212 is the live version.
--
-- BACKWARD COMPATIBLE with the caller: a payload WITHOUT `spokenAt` yields null, which is
-- what the previous version always produced. Nothing that works today changes behaviour.

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
    -- NULLIF so a JSON null, an empty string and an absent key all land as SQL null rather
    -- than raising. A segment whose time is unknown must stay unknown: stamping it with the
    -- start of the call would make the NEXT turn's gap measure from a time nobody spoke at,
    -- and the pace score is exactly that gap.
    nullif(e->>'spokenAt', '')::timestamptz
  from jsonb_array_elements(p_segments) as e;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Server-only mechanism: never client-callable (it takes a tenant id and writes the canonical transcript).
revoke all on function replace_session_transcript(uuid, jsonb) from public;
revoke execute on function replace_session_transcript(uuid, jsonb) from anon, authenticated;
grant execute on function replace_session_transcript(uuid, jsonb) to service_role;
