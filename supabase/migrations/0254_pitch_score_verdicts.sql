-- 0254 — store the scorer's own verdicts instead of leaving them to be re-derived
--
-- Found while writing the data-layer wrapper for 0253. Two things scorePitch() DECIDES were not
-- being stored, so every reader would have had to work them out again from the raw rows — the
-- §2.2 duplicated-condition shape, and in both cases the re-derivation is not even possible to
-- get right.
--
-- 1. SECTION TOTALS. The launch checklist requires that the six section totals sum to `base`.
--    They do not sum from `pitch_elements.points` whenever Delivery is scaled: with no objection,
--    the five remaining Delivery skills are scored out of 27 and scaled to 35, so the raw element
--    points are ~77% of the section total that actually went into base. A Breakdown screen adding
--    up element rows would show a Delivery figure that disagrees with the score on the same page,
--    on every objection-free pitch.
--
--    The alternative was storing pre-scaled points on each element row, which keeps the sum but
--    makes each row lie: "Tonality 3.9" against a 3-point element. Element rows stay at rubric
--    weight so they read true, and the section verdict is stored as a verdict.
--
-- 2. REJECTED LOW-CONFIDENCE BONUSES. scorePitch already collects these, for a stated reason:
--    "a rejected one is recorded rather than dropped silently, so the dispute has something to
--    point at." Nothing stored them, so the promise was unkept — a rep asking "why didn't I get
--    the inside-the-home bonus" would have got exactly the answer the comment says is not good
--    enough ("the AI didn't see it") instead of "it saw it at 0.62 confidence, below the 0.80
--    floor". That is the difference between a dispute a manager can settle and one they cannot.

-- Six section totals as { "introduction": 9.5, ... }. Not a set of columns: the sections are
-- rubric config and a rubric revision that adds one must not need a migration.
alter table pitches add column if not exists section_points jsonb;

comment on column pitches.section_points is
  'Per-section totals as decided by scorePitch, POST Delivery scaling. Sums to base. Stored rather than derived from pitch_elements, which are at raw rubric weight.';

-- A third event kind. Not a bonus (it awarded nothing) and not a violation (it cost nothing) —
-- folding it into either would make it sum wrong in the one place both are totalled.
alter table pitch_events drop constraint if exists pitch_events_type_check;
alter table pitch_events add constraint pitch_events_type_check
  check (type in ('bonus', 'violation', 'rejected_bonus'));

-- The signature changes, so the old overload must GO rather than linger. `create or replace` with
-- a new parameter list creates a SECOND function; the old one would keep working AND a newly
-- created overload defaults to EXECUTE for public, quietly undoing 0253's INVARIANT 4 revoke.
drop function if exists store_pitch_score(
  uuid, uuid, timestamptz, text, numeric, numeric, numeric, numeric, boolean, text, boolean,
  jsonb, jsonb, uuid, integer, text, text, text, text
);

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
  -- [{ "type": "bonus|violation|rejected_bonus", "item_id": "...", "points": 5, "timestamp_s": 130, "evidence": "...", "confidence": 0.92 }]
  p_events               jsonb,
  -- { "introduction": 9.5, "discovery": 12.0, ... } — the scorer's own section verdict.
  p_section_points       jsonb,
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
as $fn$
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
    select id into v_pitch_id from pitches where session_id = p_session_id;
  end if;

  if v_pitch_id is null then
    insert into pitches (
      company_id, rep_id, session_id, recorded_at, duration_s, audio_url, transcript, outcome,
      base, bonus, violations, total, band, qualifying, not_qualifying_reason, delivery_scaled,
      section_points, rubric_version
    ) values (
      p_company_id, p_rep_id, p_session_id, p_recorded_at, p_duration_s, p_audio_url, p_transcript,
      p_outcome, p_base, p_bonus, p_violations, p_total, p_band, p_qualifying,
      p_not_qualifying_reason, p_delivery_scaled, p_section_points, p_rubric_version
    )
    returning id into v_pitch_id;
  else
    update pitches set
      recorded_at = p_recorded_at,
      duration_s = coalesce(p_duration_s, duration_s),
      audio_url = coalesce(p_audio_url, audio_url),
      transcript = coalesce(p_transcript, transcript),
      outcome = coalesce(p_outcome, outcome),
      base = p_base, bonus = p_bonus, violations = p_violations, total = p_total,
      band = p_band, qualifying = p_qualifying, not_qualifying_reason = p_not_qualifying_reason,
      delivery_scaled = p_delivery_scaled, section_points = p_section_points,
      rubric_version = p_rubric_version
    where id = v_pitch_id;

    -- Replace, never accumulate. A re-score that appended would double every element and break
    -- the "sections sum to base" identity on the very next read.
    delete from pitch_elements where pitch_id = v_pitch_id;
    delete from pitch_events where pitch_id = v_pitch_id;
  end if;

  insert into pitch_elements (company_id, pitch_id, element_id, grade, points, timestamp_s, evidence)
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
    insert into pitch_events (company_id, pitch_id, type, item_id, points, timestamp_s, evidence, confidence)
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
$fn$;

-- INVARIANT 4. Scoring runs server-side with the service role; nothing client-side may reach this.
revoke execute on function store_pitch_score(
  uuid, uuid, timestamptz, text, numeric, numeric, numeric, numeric, boolean, text, boolean,
  jsonb, jsonb, jsonb, uuid, integer, text, text, text, text
) from public, anon, authenticated;
