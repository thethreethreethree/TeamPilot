-- 0269 — a transcript has VERSIONS: a repair or a relabel writes a new one, and the old one stays.
--
-- WHY. coaching_transcript_segments has been append-only since 0070 (`_no_delete` / `_no_update` rules: a
-- DELETE or UPDATE silently does nothing). Two features were built as if it were not:
--   · replace_session_transcript (0212, 2026-08-14; 0249) deleted a session's segments and inserted new ones.
--     The delete did nothing, so the insert hit (session_id, seq) and raised 23505: every re-transcribe,
--     relabel and hourly auto-recovery of a transcript that already had segments failed. Production
--     2026-10-03: 12 calls in 2 companies hold segments, no rep speech, and cannot be repaired.
--   · /attribute-unlabelled relabelled speakers with an UPDATE; it changed nothing and reported success.
--     No segment in production has ever had source = 'manual'.
-- Founder picker 2026-10-03: keep history — a repair writes a new version, the old one stays (§3.1).
--
-- WHAT.
--   1. `version` (existing rows become version 1 through ADD COLUMN's default, not an UPDATE the rule would drop).
--   2. Unique per (session_id, version, seq) instead of (session_id, seq). The append path's 23505 idempotency
--      (a replayed finalize is a no-op) holds within a version exactly as before.
--   3. An insert that names no version lands in the session's CURRENT version (a trigger), so the live capture
--      and the label/append writers need no change.
--   4. `coaching_transcript_segments_current`: only each session's newest version. security_invoker, so the
--      caller's RLS on the base table applies (A30). Every reader reads this; writers keep the table.
--   5. replace_session_transcript inserts version max+1 instead of deleting. An empty payload adds nothing (the
--      old version stays current) rather than blanking the transcript.
--   6. relabel_session_transcript copies the current version into max+1 with one speaker changed.
-- The append-only rules are untouched: nothing is ever deleted or updated.
--
-- Safe to re-run (A12): every step is if-exists / if-not-exists / or-replace, and the constraint swap tolerates
-- either the old or the new constraint being present.

-- 1. The version column. NOT NULL DEFAULT 1 fills the existing rows; the default is then dropped so the trigger
--    (3) can tell "no version given" (NULL) from "version 1".
alter table public.coaching_transcript_segments add column if not exists version integer not null default 1;
alter table public.coaching_transcript_segments alter column version drop default;

-- 2. Uniqueness per version.
alter table public.coaching_transcript_segments drop constraint if exists coaching_transcript_segments_session_seq_unique;
alter table public.coaching_transcript_segments drop constraint if exists coaching_transcript_segments_session_version_seq_unique;
alter table public.coaching_transcript_segments
  add constraint coaching_transcript_segments_session_version_seq_unique unique (session_id, version, seq);

-- 3. A write that names no version joins the session's current one (version 1 for a new session).
create or replace function public.coaching_transcript_segments_fill_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.version is null then
    select coalesce(max(version), 1) into new.version
    from coaching_transcript_segments
    where session_id = new.session_id;
  end if;
  return new;
end;
$$;
revoke all on function public.coaching_transcript_segments_fill_version() from public;

drop trigger if exists coaching_transcript_segments_fill_version on public.coaching_transcript_segments;
create trigger coaching_transcript_segments_fill_version
  before insert on public.coaching_transcript_segments
  for each row execute function public.coaching_transcript_segments_fill_version();

-- 4. What every reader reads: each session's newest version only.
create or replace view public.coaching_transcript_segments_current
with (security_invoker = true) as
select t.*
from public.coaching_transcript_segments t
where t.version = (
  select max(t2.version) from public.coaching_transcript_segments t2 where t2.session_id = t.session_id
);
grant select on public.coaching_transcript_segments_current to authenticated, service_role;

-- 5. A repair appends a new version. One writer per session at a time, so two repairs cannot claim the same one.
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
  v_next integer;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text, 2690));
  select coalesce(max(version), 0) + 1 into v_next
  from coaching_transcript_segments
  where session_id = p_session_id;

  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, version)
  select
    p_session_id,
    (e->>'speaker'),
    (e->>'text'),
    (e->>'seq')::integer,
    -- NULLIF so a JSON null, an empty string and an absent key all land as SQL null (0249's rule): a segment
    -- whose time is unknown stays unknown.
    nullif(e->>'spokenAt', '')::timestamptz,
    v_next
  from jsonb_array_elements(p_segments) as e;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function replace_session_transcript(uuid, jsonb) from public;
revoke execute on function replace_session_transcript(uuid, jsonb) from anon, authenticated;
grant execute on function replace_session_transcript(uuid, jsonb) to service_role;

-- 6. A relabel appends a new version with one speaker changed (source 'manual' on the changed rows). Returns how
--    many rows changed speaker; 0, and nothing written, when the current version has no p_from rows (so a second,
--    slower answer to the same question changes nothing).
create or replace function relabel_session_transcript(
  p_session_id uuid,
  p_from text,
  p_to text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur integer;
  v_changed integer;
begin
  if p_from = p_to then
    return 0;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text, 2690));
  select max(version) into v_cur from coaching_transcript_segments where session_id = p_session_id;
  if v_cur is null then
    return 0;
  end if;
  select count(*) into v_changed
  from coaching_transcript_segments
  where session_id = p_session_id and version = v_cur and speaker = p_from;
  if v_changed = 0 then
    return 0;
  end if;

  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, source, version)
  select
    session_id,
    case when speaker = p_from then p_to else speaker end,
    text,
    seq,
    spoken_at,
    case when speaker = p_from then 'manual' else source end,
    v_cur + 1
  from coaching_transcript_segments
  where session_id = p_session_id and version = v_cur;

  return v_changed;
end;
$$;
revoke all on function relabel_session_transcript(uuid, text, text) from public;
revoke execute on function relabel_session_transcript(uuid, text, text) from anon, authenticated;
grant execute on function relabel_session_transcript(uuid, text, text) to service_role;
