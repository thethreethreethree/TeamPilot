-- 0272_rss_p1_capture.sql
-- ELOSTATE Remote Sales System - Phase 1: remote capture.
--   1. 'phone' becomes a session context beside 'in_person' and 'video'.
--   2. session_failures: a closed list of reasons a session was not analysed or scored (F5.9).
-- The required-outcome rule for remote sessions (F25.9) is enforced in code
-- (src/lib/coach/remote/session/state.ts closeWithOutcome) because the live status columns were
-- not visible when this was written; see docs/03 "Deliberately not in SQL".

-- ---------------------------------------------------------------- preflight
do $$
declare n int;
begin
  select count(*) into n from pg_constraint c join pg_class t on t.oid = c.conrelid
   where t.relname = 'coaching_sessions' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%in_person%';
  if n <> 1 then
    raise exception 'RSS preflight: expected exactly 1 check constraint on coaching_sessions mentioning in_person, found %. Read 0070/0237 and adjust.', n;
  end if;
end $$;

-- ---------------------------------------------------------------- 1. phone context
do $$
declare cname text; def text;
begin
  select c.conname, pg_get_constraintdef(c.oid) into cname, def from pg_constraint c join pg_class t on t.oid = c.conrelid
   where t.relname = 'coaching_sessions' and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%in_person%';
  if def like '%phone%' then return; end if;  -- already there
  execute format('alter table public.coaching_sessions drop constraint %I', cname);
end $$;
alter table public.coaching_sessions add constraint coaching_sessions_context_check
  check (context in ('in_person', 'video', 'phone'));
comment on column public.coaching_sessions.context is
  'in_person (door / face to face), video, phone. RSS added phone; door sessions are unchanged.';

-- Session -> rep, for policies on child tables (security definer: no recursion into session RLS).
create function public.rss_session_rep(sid uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select agent_id from coaching_sessions where id = sid
$$;

-- ---------------------------------------------------------------- 2. failure reasons
create table public.session_failures (
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
  'RSS: append-only. Mirrors FAILURE_REASONS + NOT_SCORED_REASONS in session/state.ts - change both together.';
create index session_failures_session_idx on public.session_failures (session_id);
alter table public.session_failures enable row level security;
create policy rss_failures_select on public.session_failures for select to authenticated
  using (rss_can_view_rep(auth.uid(), rss_session_rep(session_id)));
-- Deliberately NO insert/update/delete policies: the pipeline (service role) records failures.
