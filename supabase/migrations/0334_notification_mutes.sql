-- 0334 — a person can turn off FYI bell notices for themselves (2026-11-25; Gong ledger F30.1; founder picker 2026-11-25:
-- "Only FYI notices").
--
-- Only the four notices that merely inform may be muted: strong_session, deal_closed, call_ready, call_scored. Notices
-- that ask someone to act (a dispute to answer, a feedback request, a mention, a score correction, …) always arrive —
-- the CHECK below is that rule, not a list the screen could drift from.
--
-- Muting HIDES, it does not stop the record: notifications are still written; the bell leaves muted types out of the
-- list and the unread count. Each change is a new row (append-only); the latest per (user, type) wins.
-- Written by /api/me/notification-mutes with the service role, the user and company taken from the session. Re-runnable.

create table if not exists public.notification_mutes (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  user_id uuid not null references public.profiles(id),
  type text not null check (type in ('strong_session', 'deal_closed', 'call_ready', 'call_scored')),
  muted boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists notification_mutes_idx on public.notification_mutes (user_id, type, id desc);

alter table public.notification_mutes enable row level security;
drop policy if exists rss_notification_mutes_select on public.notification_mutes;
create policy rss_notification_mutes_select on public.notification_mutes for select to authenticated
  using (user_id = auth.uid() and company_id = auth_company_id());
drop policy if exists mfa_required on public.notification_mutes;
create policy mfa_required on public.notification_mutes as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule notification_mutes_no_update as on update to public.notification_mutes do instead nothing;
create or replace rule notification_mutes_no_delete as on delete to public.notification_mutes do instead nothing;
