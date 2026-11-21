-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0275 — RSS Phase 1: remote capture (docs/rss, scaffold 0272_rss_p1_capture.sql, renumbered)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--   1. 'phone' becomes a session context beside 'in_person' and 'video' (D1, decided: phone + video).
--      The app's one list is src/lib/coach/sessionContext.ts SALES_CONTEXTS — change both together.
--   2. session_failures: the closed list of reasons a remote session was not analysed or scored (F5.9).
--      Mirrors FAILURE_REASONS + NOT_SCORED_REASONS in src/lib/coach/remote/session/state.ts.
--
-- The required-outcome rule (F25.9) is enforced in code (closeWithOutcome, used by the finalize route), not
-- here: coaching_sessions.status is only active/ended/reviewed (0070), so there is no state for a CHECK to
-- key on, and production holds sessions closed without an outcome that a constraint would refuse.
--
-- DIFFERENCES FROM THE SCAFFOLD: re-runnable (A12) — the context check is dropped by definition and re-added
-- under one name; the table is if-not-exists; append-only rules added. The read policy reuses the session's
-- own select policy (owner, or a manager of the rep under 0273's reporting tree) instead of a second copy of
-- that rule (§2.2).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- ─── preflight ────────────────────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from pg_constraint c join pg_class t on t.oid = c.conrelid
   where t.relname = 'coaching_sessions' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%in_person%';
  if n <> 1 then
    raise exception 'RSS preflight: expected exactly 1 check constraint on coaching_sessions mentioning in_person, found %. Read 0070/0237 and adjust.', n;
  end if;
end $$;

-- ─── 1. phone context ─────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select c.conname from pg_constraint c join pg_class t on t.oid = c.conrelid
     where t.relname = 'coaching_sessions' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%in_person%'
  loop
    execute format('alter table public.coaching_sessions drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.coaching_sessions add constraint coaching_sessions_context_check
  check (context in ('in_person', 'video', 'phone'));
comment on column public.coaching_sessions.context is
  'in_person (door / face to face), video, phone. RSS added phone (0275); door sessions are unchanged.';

-- ─── 2. failure reasons ───────────────────────────────────────────────────────────────────────
create table if not exists public.session_failures (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  reason_code text not null check (reason_code in (
    'NO_AUDIO', 'NO_SPEECH', 'ONE_SIDED_CAPTURE', 'TOO_LARGE', 'TRANSCRIBE_TIMEOUT', 'AI_UNAVAILABLE', 'AI_QUOTA',
    'BELOW_SCORING_FLOOR', 'NOT_A_SALES_CALL')),
  detail text,
  created_at timestamptz not null default now()
);
comment on table public.session_failures is
  'RSS: append-only. Mirrors FAILURE_REASONS + NOT_SCORED_REASONS in src/lib/coach/remote/session/state.ts - change both together.';
create index if not exists session_failures_session_idx on public.session_failures (session_id, created_at);
alter table public.session_failures enable row level security;

drop policy if exists rss_failures_select on public.session_failures;
create policy rss_failures_select on public.session_failures for select to authenticated
  using (
    company_id = auth_company_id()
    and exists (select 1 from coaching_sessions s where s.id = session_failures.session_id)  -- the session's own RLS
  );
-- No insert/update/delete policies: the pipeline (service role) records failures.
create or replace rule session_failures_no_update as on update to public.session_failures do instead nothing;
create or replace rule session_failures_no_delete as on delete to public.session_failures do instead nothing;
