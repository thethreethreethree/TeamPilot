-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0284 — RSS Phase 8: protection (scaffold 0278_rss_p8_protection.sql, renumbered; Gong F31.5, F33.1, F33.6, F9.17)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
--   audit_log — who did what to a recording, score or export. Written by the server only; a trigger refuses update
--     and delete for everyone, service role included (loud, not a silent rule). Company admins read it.
--   company_recording_settings — the per-company "keep each rep's last N recordings" (D14). No row = today's 20
--     (recording-purge-cron KEEP_PER_REP). A change is a new row; the current value is the latest (§3.1).
--   recording_trims / recording_trim_restores — a manager cuts a section out of a call (F9.17): it leaves
--     playback, transcript and AI reads; the original audio is kept so the trim can be undone (a restore row).
--   erasure_requests — a company admin's "erase everything for this customer". The identifier is NEVER stored: only
--     a keyed hash (HMAC, server-side) and a masked hint ("phone ••••0123"), so the record of an erasure does not
--     re-store what was erased (CLAUDE.md §3.1.1, AMD-014). The erasure itself is 0285.
--
-- DIFFERENCES FROM THE SCAFFOLD: policies use auth_company_id() and admin_roles() — the scaffold's
-- rss_is_company_admin / rss_is_manager are revoked from `authenticated` (0272:180), so a policy calling them would
-- fail for every signed-in reader. No client write policies anywhere: routes write after their own checks (as 0282).
-- Retention is append rows, not an upserted single row. Trims gain restores (F9.17 "restorable"). erasure_requests
-- loses completed_at / sessions_erased (completion is its own row, 0285) and match_value (hash + hint instead). Idempotent (A12).
-- No redaction table: redaction is code and stays off until D15.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rss_tree_allows') then
    raise exception 'RSS preflight: rss_tree_allows() not found — apply 0273 first';
  end if;
end $$;

-- ── audit_log ────────────────────────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  actor_id uuid references public.profiles(id),
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  object_type text not null check (length(object_type) between 1 and 60),
  object_id text not null check (length(object_id) between 1 and 200),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_company_time_idx on public.audit_log (company_id, created_at desc);
create index if not exists audit_log_object_idx on public.audit_log (object_type, object_id);
create or replace function public.rss_audit_append_only() returns trigger
  language plpgsql set search_path = public as $$
begin
  raise exception 'RSS: audit_log is append-only';
end $$;
drop trigger if exists rss_audit_no_change on public.audit_log;
create trigger rss_audit_no_change before update or delete on public.audit_log
  for each row execute function public.rss_audit_append_only();
alter table public.audit_log enable row level security;
drop policy if exists rss_audit_select on public.audit_log;
create policy rss_audit_select on public.audit_log for select to authenticated
  using (company_id = auth_company_id() and exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = any (admin_roles()) and p.status <> 'removed'));

-- ── company_recording_settings ───────────────────────────────────────────────────────────────
create table if not exists public.company_recording_settings (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  keep_last_per_rep integer not null check (keep_last_per_rep between 1 and 1000),
  set_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists company_recording_settings_company_idx on public.company_recording_settings (company_id, id desc);
alter table public.company_recording_settings enable row level security;
drop policy if exists rss_crs_select on public.company_recording_settings;
create policy rss_crs_select on public.company_recording_settings for select to authenticated
  using (company_id = auth_company_id());
create or replace rule company_recording_settings_no_update as on update to public.company_recording_settings do instead nothing;
create or replace rule company_recording_settings_no_delete as on delete to public.company_recording_settings do instead nothing;

-- ── recording_trims + restores ───────────────────────────────────────────────────────────────
create table if not exists public.recording_trims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null,
  trimmed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint recording_trims_range check (end_ms > start_ms)
);
create index if not exists recording_trims_session_idx on public.recording_trims (session_id, created_at);
alter table public.recording_trims enable row level security;
drop policy if exists rss_trim_select on public.recording_trims;
create policy rss_trim_select on public.recording_trims for select to authenticated
  using (company_id = auth_company_id() and exists (
    select 1 from coaching_sessions s where s.id = recording_trims.session_id
      and (s.agent_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(s.agent_id)))));
create or replace rule recording_trims_no_update as on update to public.recording_trims do instead nothing;
create or replace rule recording_trims_no_delete as on delete to public.recording_trims do instead nothing;

create table if not exists public.recording_trim_restores (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  trim_id uuid not null references public.recording_trims(id) on delete cascade,
  restored_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint recording_trim_restores_once unique (trim_id)
);
alter table public.recording_trim_restores enable row level security;
drop policy if exists rss_trim_restore_select on public.recording_trim_restores;
create policy rss_trim_restore_select on public.recording_trim_restores for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from recording_trims t where t.id = recording_trim_restores.trim_id));
create or replace rule recording_trim_restores_no_update as on update to public.recording_trim_restores do instead nothing;
create or replace rule recording_trim_restores_no_delete as on delete to public.recording_trim_restores do instead nothing;

-- ── erasure_requests (the erasure itself is 0285) ────────────────────────────────────────────
create table if not exists public.erasure_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  requested_by uuid not null references public.profiles(id),
  match_kind text not null check (match_kind in ('phone', 'email', 'client_label')),
  match_hash text not null check (match_hash ~ '^[0-9a-f]{64}$'),
  match_hint text not null check (length(match_hint) between 1 and 60),
  created_at timestamptz not null default now()
);
alter table public.erasure_requests enable row level security;
drop policy if exists rss_er_select on public.erasure_requests;
create policy rss_er_select on public.erasure_requests for select to authenticated
  using (company_id = auth_company_id() and exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = any (admin_roles()) and p.status <> 'removed'));
create or replace rule erasure_requests_no_update as on update to public.erasure_requests do instead nothing;
create or replace rule erasure_requests_no_delete as on delete to public.erasure_requests do instead nothing;

-- ── a trim leaves the transcript, for every reader and every future version ──────────────────
-- WHY A FILTER IN THE VIEW, NOT A TRIMMED VERSION. A trimmed version alone is undone by the next re-transcribe,
-- relabel, voice assignment or hourly recovery (four writers, each inserting a fresh full version), and the cut
-- words would come back. Every transcript reader reads coaching_transcript_segments_current (an invariant-audit
-- rule), so a filter here applies to all of them and to every version yet to be written.
-- rss_line_trimmed is SECURITY DEFINER on purpose: it reveals one boolean about a line the caller is already
-- reading, and it must not depend on whether the caller's RLS shows them the trim row (a company admin outside the
-- tree, a rep on their own call) — a hidden trim row would otherwise leave the cut words visible to that reader.
-- A line with no spoken_at cannot be placed on the recording and is kept; the trim route refuses such calls.
-- ANY LATER MIGRATION THAT REDEFINES coaching_transcript_segments_current MUST KEEP THIS PREDICATE.
create or replace function public.rss_line_trimmed(p_session uuid, p_start timestamptz, p_end timestamptz) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_start is not null and exists (
    select 1
    from recording_trims tr
    join coaching_sessions s on s.id = tr.session_id
    where tr.session_id = p_session
      and not exists (select 1 from recording_trim_restores r where r.trim_id = tr.id)
      and extract(epoch from (p_start - s.started_at)) * 1000 < tr.end_ms
      and extract(epoch from (coalesce(p_end, p_start) - s.started_at)) * 1000 >= tr.start_ms
  )
$$;
revoke all on function public.rss_line_trimmed(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.rss_line_trimmed(uuid, timestamptz, timestamptz) to authenticated, service_role;

create or replace view public.coaching_transcript_segments_current
with (security_invoker = true) as
select t.*
from public.coaching_transcript_segments t
where t.version = (
  select max(t2.version) from public.coaching_transcript_segments t2 where t2.session_id = t.session_id
)
and not public.rss_line_trimmed(t.session_id, t.spoken_at, t.ended_at);
grant select on public.coaching_transcript_segments_current to authenticated, service_role;

-- A trim or restore must also make the AI reads recompute. They are stored once per transcript version (stats,
-- tracker hits, follow-through), so the trim route copies the current version into a new one — same lines, same
-- provenance (source, speaker_cluster kept) — and re-runs the engines on it, which now read the filtered view.
create or replace function public.copy_transcript_version(p_session_id uuid) returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_cur integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text, 2690));
  select max(version) into v_cur from coaching_transcript_segments where session_id = p_session_id;
  if v_cur is null then
    return 0;
  end if;
  insert into coaching_transcript_segments (session_id, speaker, text, seq, spoken_at, ended_at, source, speaker_cluster, version)
  select session_id, speaker, text, seq, spoken_at, ended_at, source, speaker_cluster, v_cur + 1
  from coaching_transcript_segments
  where session_id = p_session_id and version = v_cur;
  return v_cur + 1;
end;
$$;
revoke all on function public.copy_transcript_version(uuid) from public;
revoke execute on function public.copy_transcript_version(uuid) from anon, authenticated;
grant execute on function public.copy_transcript_version(uuid) to service_role;
