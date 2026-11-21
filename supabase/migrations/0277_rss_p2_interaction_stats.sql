-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0277 — RSS Phase 2: segment end times + interaction stats (scaffold 0273_rss_p2_interaction_stats.sql)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- Founder picker 2026-11-15 ("Store them, estimate old calls"): the transcript stored only when a line STARTED
-- (spoken_at). Interactivity, patience and "pauses don't break a monologue" need when it ENDED. So:
--   1. coaching_transcript_segments.ended_at — nullable; filled for recorded-audio reads from the diarizer's
--      word timings (they were computed and dropped). Older and live lines stay null and are ESTIMATED
--      ("until the next person speaks"), and every stats row says whether it was estimated.
--   2. coaching_transcript_segments_current is recreated so it exposes the new column (a view's `t.*` is fixed
--      when the view is created). Same definition as 0269, security_invoker kept.
--   3. replace_session_transcript and relabel_session_transcript carry ended_at. Both are 0270's text verbatim,
--      plus the one column.
--   4. session_interaction_stats — one row per (session, transcript version), append-only; a repaired
--      transcript is a new version and a new row. Read rule: the session's (owner, or a manager under 0273's
--      reporting tree).
--
-- Idempotent (A12). The segments table's append-only rules (0070) are untouched.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rss_tree_allows') then
    raise exception 'RSS preflight: rss_tree_allows() not found — apply 0273 first';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='coaching_transcript_segments' and column_name='speaker_cluster') then
    raise exception 'RSS preflight: coaching_transcript_segments.speaker_cluster not found — apply 0270 first';
  end if;
end $$;

-- ─── 1. end times ─────────────────────────────────────────────────────────────────────────────
alter table public.coaching_transcript_segments add column if not exists ended_at timestamptz;
comment on column public.coaching_transcript_segments.ended_at is
  'RSS Phase 2 (0277): when the line''s last word ended. Null = unknown (live capture, older reads): stats then ESTIMATE it.';

-- ─── 2. the view every reader reads (0269), now with ended_at ──────────────────────────────────
create or replace view public.coaching_transcript_segments_current
with (security_invoker = true) as
select t.*
from public.coaching_transcript_segments t
where t.version = (
  select max(t2.version) from public.coaching_transcript_segments t2 where t2.session_id = t.session_id
);
grant select on public.coaching_transcript_segments_current to authenticated, service_role;

-- ─── 3. the two writers that build a version (0270 verbatim + ended_at) ────────────────────────
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

  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, speaker_cluster, ended_at, version)
  select
    p_session_id,
    (e->>'speaker'),
    (e->>'text'),
    (e->>'seq')::integer,
    nullif(e->>'spokenAt', '')::timestamptz,
    nullif(e->>'speakerId', ''),
    nullif(e->>'endedAt', '')::timestamptz,
    v_next
  from jsonb_array_elements(p_segments) as e;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function replace_session_transcript(uuid, jsonb) from public;
revoke execute on function replace_session_transcript(uuid, jsonb) from anon, authenticated;
grant execute on function replace_session_transcript(uuid, jsonb) to service_role;

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

  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, source, speaker_cluster, ended_at, version)
  select
    session_id,
    case when speaker = p_from then p_to else speaker end,
    text,
    seq,
    spoken_at,
    case when speaker = p_from then 'manual' else source end,
    speaker_cluster,
    ended_at,
    v_cur + 1
  from coaching_transcript_segments
  where session_id = p_session_id and version = v_cur;

  return v_changed;
end;
$$;
revoke all on function relabel_session_transcript(uuid, text, text) from public;
revoke execute on function relabel_session_transcript(uuid, text, text) from anon, authenticated;
grant execute on function relabel_session_transcript(uuid, text, text) to service_role;

-- ─── 4. interaction stats ─────────────────────────────────────────────────────────────────────
create table if not exists public.session_interaction_stats (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  rep_id uuid not null references public.profiles(id),
  transcript_version integer not null,
  -- True when any line's end was estimated ("until the next person speaks"): pauses then count as talk.
  estimated boolean not null,
  talk_ratio_time numeric check (talk_ratio_time between 0 and 1),        -- null: no known speech
  longest_rep_monologue_ms integer not null check (longest_rep_monologue_ms >= 0),
  longest_customer_story_ms integer not null check (longest_customer_story_ms >= 0),
  interactivity numeric check (interactivity between 0 and 10),          -- null: only one side spoke
  patience_ms integer check (patience_ms >= 0),                          -- null: rep never answered the customer
  rep_questions_per_hour numeric check (rep_questions_per_hour >= 0),
  computed_at timestamptz not null default now(),
  constraint session_interaction_stats_once unique (session_id, transcript_version)
);
comment on table public.session_interaction_stats is
  'RSS (0277): nulls mean "not measurable on this session", never "not filled in yet". One row per transcript version; append-only.';
create index if not exists session_interaction_stats_rep_idx on public.session_interaction_stats (company_id, rep_id, computed_at desc);
alter table public.session_interaction_stats enable row level security;

drop policy if exists rss_stats_select on public.session_interaction_stats;
create policy rss_stats_select on public.session_interaction_stats for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
-- No write policies: computed by the pipeline (service role).
create or replace rule session_interaction_stats_no_update as on update to public.session_interaction_stats do instead nothing;
create or replace rule session_interaction_stats_no_delete as on delete to public.session_interaction_stats do instead nothing;
