-- 0270 — a transcript line keeps WHICH VOICE the diarizer heard, so "whose voice is this?" can be asked per voice.
--
-- WHY. When the diarizer separates two voices but cannot tell which is the rep, recovery saves every line as
-- 'unknown' and threw the diarizer's speaker id away. The only question left to ask was "is THIS voice you?",
-- answered for every line at once: on a two-voice call (production 2026-10-03: cef6995b, 26 lines; 8bde1ce2, 44)
-- "That's me" would have made the customer's lines the rep's and scored them. A39: per-party attribution must
-- travel with the text from its source; this is the boundary where it was dropped.
-- Founder picker 2026-10-03: "Keep voices apart".
--
-- WHAT.
--   1. `speaker_cluster` (nullable): the diarizer's id for the voice of this line. NULL on every existing row and
--      on live capture, which labels speakers as it goes.
--   2. The `_current` view is recreated so it carries the new column (a view's `*` is fixed when it is created).
--   3. replace_session_transcript stores each segment's `speakerId` as speaker_cluster.
--   4. relabel_session_transcript copies speaker_cluster into the version it writes.
--   5. assign_session_voices(session, agent_cluster): a new version in which that voice is 'agent' and every other
--      voice 'customer', source 'manual'. Refuses (returns 0, writes nothing) unless every line of the current
--      version is 'unknown', none is a person's answer, every line has a voice, and the named voice is one of them.
-- Append-only throughout (the 0070 rules stay; INVARIANT 33). Safe to re-run (A12).

-- 1.
alter table public.coaching_transcript_segments add column if not exists speaker_cluster text;

-- 2. Recreated with the same definition; the new column joins at the end, which create-or-replace allows.
create or replace view public.coaching_transcript_segments_current
with (security_invoker = true) as
select t.*
from public.coaching_transcript_segments t
where t.version = (
  select max(t2.version) from public.coaching_transcript_segments t2 where t2.session_id = t.session_id
);
grant select on public.coaching_transcript_segments_current to authenticated, service_role;

-- 3.
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

  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, speaker_cluster, version)
  select
    p_session_id,
    (e->>'speaker'),
    (e->>'text'),
    (e->>'seq')::integer,
    nullif(e->>'spokenAt', '')::timestamptz,
    nullif(e->>'speakerId', ''),
    v_next
  from jsonb_array_elements(p_segments) as e;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function replace_session_transcript(uuid, jsonb) from public;
revoke execute on function replace_session_transcript(uuid, jsonb) from anon, authenticated;
grant execute on function replace_session_transcript(uuid, jsonb) to service_role;

-- 4.
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

  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, source, speaker_cluster, version)
  select
    session_id,
    case when speaker = p_from then p_to else speaker end,
    text,
    seq,
    spoken_at,
    case when speaker = p_from then 'manual' else source end,
    speaker_cluster,
    v_cur + 1
  from coaching_transcript_segments
  where session_id = p_session_id and version = v_cur;

  return v_changed;
end;
$$;
revoke all on function relabel_session_transcript(uuid, text, text) from public;
revoke execute on function relabel_session_transcript(uuid, text, text) from anon, authenticated;
grant execute on function relabel_session_transcript(uuid, text, text) to service_role;

-- 5.
create or replace function assign_session_voices(
  p_session_id uuid,
  p_agent_cluster text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur integer;
  v_total integer;
  v_ok integer;
  v_agent integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text, 2690));
  select max(version) into v_cur from coaching_transcript_segments where session_id = p_session_id;
  if v_cur is null or p_agent_cluster is null then
    return 0;
  end if;
  select count(*),
         count(*) filter (where speaker = 'unknown' and source is distinct from 'manual' and speaker_cluster is not null),
         count(*) filter (where speaker_cluster = p_agent_cluster)
    into v_total, v_ok, v_agent
  from coaching_transcript_segments
  where session_id = p_session_id and version = v_cur;
  -- Only a fully unattributed, unanswered transcript that knows its voices, and only a voice it actually has.
  if v_total = 0 or v_ok <> v_total or v_agent = 0 then
    return 0;
  end if;

  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, source, speaker_cluster, version)
  select
    session_id,
    case when speaker_cluster = p_agent_cluster then 'agent' else 'customer' end,
    text,
    seq,
    spoken_at,
    'manual',
    speaker_cluster,
    v_cur + 1
  from coaching_transcript_segments
  where session_id = p_session_id and version = v_cur;

  return v_agent;
end;
$$;
revoke all on function assign_session_voices(uuid, text) from public;
revoke execute on function assign_session_voices(uuid, text) from anon, authenticated;
grant execute on function assign_session_voices(uuid, text) to service_role;
