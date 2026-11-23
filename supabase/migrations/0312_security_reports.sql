-- 0312 — vulnerability disclosure (2026-11-23; gong.io capture M36 "Submit discovered security or privacy issues",
-- graded LACK: "No security.txt or disclosure process").
--
-- Anyone — usually a researcher with no account — reports a security or privacy issue from the public /security
-- page (linked from /.well-known/security.txt). Reports reach the founders' vendor inbox only.
--
-- Both tables are SEALED: RLS on and no policy, so no signed-in or anonymous client can read or write them; the public
-- route inserts with the service role, and the inbox reads with the service role behind requireVendorAdmin. A report
-- never belongs to a customer company. Append-only (§3.1): a report is never edited; triage is a status event.
-- No IP address is stored. Re-runnable.

create table if not exists public.security_reports (
  id uuid primary key default gen_random_uuid(),
  summary text not null check (length(trim(summary)) between 5 and 200),
  details text not null check (length(trim(details)) between 20 and 8000),
  affected text check (affected is null or length(affected) <= 500),
  reporter_name text check (reporter_name is null or length(reporter_name) <= 100),
  reporter_contact text check (reporter_contact is null or length(reporter_contact) <= 200),
  received_at timestamptz not null default now()
);
create index if not exists security_reports_received_idx on public.security_reports (received_at desc);
alter table public.security_reports enable row level security;
create or replace rule security_reports_no_update as on update to public.security_reports do instead nothing;
create or replace rule security_reports_no_delete as on delete to public.security_reports do instead nothing;

create table if not exists public.security_report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.security_reports(id),
  status text not null check (status in ('triaged', 'fixed', 'not_an_issue', 'duplicate')),
  note text check (note is null or length(note) <= 2000),
  set_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists security_report_events_idx on public.security_report_events (report_id, id);
alter table public.security_report_events enable row level security;
create or replace rule security_report_events_no_update as on update to public.security_report_events do instead nothing;
create or replace rule security_report_events_no_delete as on delete to public.security_report_events do instead nothing;

revoke all on public.security_reports from anon, authenticated;
revoke all on public.security_report_events from anon, authenticated;
