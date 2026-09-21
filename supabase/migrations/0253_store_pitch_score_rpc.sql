-- 0253 — store_pitch_score: write a scored pitch and its evidence in ONE transaction
--
-- WHY AN RPC AND NOT THREE INSERTS FROM THE DATA LAYER. supabase-js cannot span statements in a
-- transaction, so a data-layer write would insert the pitch, then the elements, then the events —
-- and a failure between them leaves a Pitch Score with no evidence behind it. That row is the
-- "unexplainable number" the rubric exists to prevent: the rep's Pitch detail shows a score with
-- no element rows, the Dispute button has nothing to point at, and Pattern Interrupt later scans
-- pitch_score_elements and simply cannot see that pitch. All of it silent.
--
-- One function, one transaction: either the score and every piece of its evidence land, or none
-- of it does.
--
-- NOT CLIENT-CALLABLE. This is a SECURITY DEFINER function taking a company id as a PARAMETER,
-- which is exactly the shape INVARIANT 4 of the invariant audit exists to catch: PostgREST exposes
-- every public function as an RPC, so without the revoke below any authenticated user could call
-- it with somebody else's company id and write into their tenant. Scoring is a server-side job
-- with the service role, so the revoke removes the attack surface rather than defending it — the
-- audit's own stated preference, because a guard is a rule the next author forgets.
--
-- Idempotent on the session: re-scoring an already-scored session REPLACES its evidence rather
-- than accumulating a second copy. The existing dissect pipeline already re-runs on auto-heal, so
-- this path is real, not hypothetical.

-- One pitch per coaching session. Without this, an auto-heal re-run silently creates a second
-- scored pitch for the same recording and the rep's average is computed over a duplicate.
create unique index if not exists pitches_one_per_session
  on pitch_scores (session_id) where session_id is not null;

create or replace function store_pitch_score(
  p_company_id           uuid,
  p_rep_id               uuid,
  p_recorded_at          timestamptz,
  p_rubric_version       text,
  p_base                 numeric,
  p_bonus                numeric,
  p_violations           numeric,
  p_total                numeric,
  p_qualifying           boolean,
  p_not_qualifying_reason text,
  p_delivery_scaled      boolean,
  -- [{ "element_id": "...", "grade": "hit|partial|missed", "points": 3, "timestamp_s": 12, "evidence": "..." }]
  p_elements             jsonb,
  -- [{ "type": "bonus|violation", "item_id": "...", "points": 5, "timestamp_s": 130, "evidence": "...", "confidence": 0.92 }]
  p_events               jsonb,
  p_session_id           uuid default null,
  p_duration_s           integer default null,
  p_audio_url            text default null,
  p_transcript           text default null,
  p_outcome              text default null,
  p_band                 text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pitch_id uuid;
begin
  -- Refuse an evidence-free score outright. The caller should never produce one — generatePitchScore
  -- returns a failure rather than an empty grading — but this is the last place it can be stopped
  -- before it becomes a number on a rep's leaderboard that nobody can explain.
  if p_elements is null or jsonb_typeof(p_elements) <> 'array' or jsonb_array_length(p_elements) = 0 then
    raise exception 'store_pitch_score: a pitch cannot be stored without element grades (score % would be unexplainable)', p_total;
  end if;

  -- Re-score of a session we already have: reuse the row so the pitch id stays stable for anything
  -- already pointing at it (comments, overrides, pattern clips), and clear the old evidence.
  if p_session_id is not null then
    select id into v_pitch_id from pitch_scores where session_id = p_session_id;
  end if;

  if v_pitch_id is null then
    insert into pitch_scores (
      company_id, rep_id, session_id, recorded_at, duration_s, audio_url, transcript, outcome,
      base, bonus, violations, total, band, qualifying, not_qualifying_reason, delivery_scaled,
      rubric_version
    ) values (
      p_company_id, p_rep_id, p_session_id, p_recorded_at, p_duration_s, p_audio_url, p_transcript,
      p_outcome, p_base, p_bonus, p_violations, p_total, p_band, p_qualifying,
      p_not_qualifying_reason, p_delivery_scaled, p_rubric_version
    )
    returning id into v_pitch_id;
  else
    update pitch_scores set
      recorded_at = p_recorded_at,
      duration_s = coalesce(p_duration_s, duration_s),
      audio_url = coalesce(p_audio_url, audio_url),
      transcript = coalesce(p_transcript, transcript),
      outcome = coalesce(p_outcome, outcome),
      base = p_base, bonus = p_bonus, violations = p_violations, total = p_total,
      band = p_band, qualifying = p_qualifying, not_qualifying_reason = p_not_qualifying_reason,
      delivery_scaled = p_delivery_scaled, rubric_version = p_rubric_version
    where id = v_pitch_id;

    -- Replace, never accumulate. A re-score that appended would double every element and break
    -- the "sections sum to base" identity on the very next read.
    delete from pitch_score_elements where pitch_id = v_pitch_id;
    delete from pitch_score_events where pitch_id = v_pitch_id;
  end if;

  insert into pitch_score_elements (company_id, pitch_id, element_id, grade, points, timestamp_s, evidence)
  select
    p_company_id,
    v_pitch_id,
    e ->> 'element_id',
    e ->> 'grade',
    coalesce((e ->> 'points')::numeric, 0),
    nullif(e ->> 'timestamp_s', '')::integer,
    nullif(e ->> 'evidence', '')
  from jsonb_array_elements(p_elements) as e;

  if p_events is not null and jsonb_typeof(p_events) = 'array' then
    insert into pitch_score_events (company_id, pitch_id, type, item_id, points, timestamp_s, evidence, confidence)
    select
      p_company_id,
      v_pitch_id,
      v ->> 'type',
      v ->> 'item_id',
      coalesce((v ->> 'points')::numeric, 0),
      nullif(v ->> 'timestamp_s', '')::integer,
      nullif(v ->> 'evidence', ''),
      nullif(v ->> 'confidence', '')::numeric
    from jsonb_array_elements(p_events) as v;
  end if;

  return v_pitch_id;
end;
$$;

-- INVARIANT 4. Scoring runs server-side with the service role; nothing client-side may reach this.
revoke execute on function store_pitch_score(
  uuid, uuid, timestamptz, text, numeric, numeric, numeric, numeric, boolean, text, boolean,
  jsonb, jsonb, uuid, integer, text, text, text, text
) from public, anon, authenticated;
