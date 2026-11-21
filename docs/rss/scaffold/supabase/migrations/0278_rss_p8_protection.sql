-- 0278_rss_p8_protection.sql
-- ELOSTATE Remote Sales System - Phase 8: protection.
--   audit_log (F31.5), recording retention per company (F33.1), erasure requests (F33.6),
--   trims (F9.17). Number redaction is code (redaction.ts) and stays OFF until D15.
--   The retention default is D14: no row = today's behaviour (keep each rep's last 20 recordings,
--   recording-purge-cron/route.ts:23). Nothing is seeded.

create table public.audit_log (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id),
  actor_id uuid references public.profiles(id),
  action text not null,               -- e.g. 'score.override', 'recording.delete', 'session.export'
  object_type text not null,
  object_id text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create function public.rss_audit_append_only() returns trigger language plpgsql as $$
begin raise exception 'RSS: audit_log is append-only'; end $$;
create trigger rss_audit_no_update before update or delete on public.audit_log
  for each row execute function public.rss_audit_append_only();
alter table public.audit_log enable row level security;
create policy rss_audit_select on public.audit_log for select to authenticated
  using (company_id = rss_company_of(auth.uid()) and rss_is_company_admin(auth.uid()));
-- Deliberately NO insert policy: the server writes audit rows (service role). The trigger blocks
-- update/delete for everyone, service role included.

create table public.company_recording_settings (
  company_id uuid primary key references public.companies(id),
  keep_last_per_rep integer not null check (keep_last_per_rep between 1 and 1000),
  set_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.company_recording_settings enable row level security;
create policy rss_crs_select on public.company_recording_settings for select to authenticated
  using (company_id = rss_company_of(auth.uid()));
create policy rss_crs_write on public.company_recording_settings for all to authenticated
  using (company_id = rss_company_of(auth.uid()) and rss_is_company_admin(auth.uid()))
  with check (company_id = rss_company_of(auth.uid()) and rss_is_company_admin(auth.uid()) and set_by = auth.uid());

create table public.erasure_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  requested_by uuid not null references public.profiles(id),
  match_kind text not null check (match_kind in ('phone', 'email', 'client_label')),
  match_value text not null check (length(trim(match_value)) > 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,            -- set by the erasure job when every match is gone
  sessions_erased integer check (sessions_erased >= 0)
);
alter table public.erasure_requests enable row level security;
create policy rss_er_select on public.erasure_requests for select to authenticated
  using (company_id = rss_company_of(auth.uid()) and rss_is_company_admin(auth.uid()));
create policy rss_er_insert on public.erasure_requests for insert to authenticated
  with check (company_id = rss_company_of(auth.uid()) and rss_is_company_admin(auth.uid()) and requested_by = auth.uid()
              and completed_at is null and sessions_erased is null);

create table public.recording_trims (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null,
  trimmed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (end_ms > start_ms)
);
alter table public.recording_trims enable row level security;
create policy rss_trim_select on public.recording_trims for select to authenticated
  using (rss_can_view_rep(auth.uid(), rss_session_rep(session_id)));
-- Managers and admins only, matching who may delete recording audio today (delete-recording/route.ts).
create policy rss_trim_insert on public.recording_trims for insert to authenticated
  with check (trimmed_by = auth.uid() and rss_is_manager(auth.uid()) and auth.uid() <> rss_session_rep(session_id)
              and rss_can_view_rep(auth.uid(), rss_session_rep(session_id)));
