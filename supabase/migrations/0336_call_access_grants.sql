-- 0336 — a company admin can give one teammate access to one call (2026-11-25; Gong ledger F3.8 "Per-call user access
-- grants"; founder picker "Admin grants, logged").
--
-- Access to a call stays what it was (the rep, managers up the reporting tree, rep-consented library peers). A GRANT is
-- the one exception: an admin names a teammate and a reason; that person may open a read-only view of that one call
-- (player, transcript, Highlights) until the grant is revoked. The view is served by a route that checks the active grant
-- (service role, company-pinned) — no RLS policy on the call's own tables is widened. The rep and the grantee are told
-- (bell, 'call_access_granted'); every grant, revoke and open is audited (audit_log).
--
-- Append-only: a revoke is a row in call_access_revocations; a grant is active while it has none. Re-runnable.

create table if not exists public.call_access_grants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id),
  grantee_id uuid not null references public.profiles(id),
  granted_by uuid not null references public.profiles(id),
  reason text not null check (length(btrim(reason)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists call_access_grants_grantee_idx on public.call_access_grants (grantee_id, session_id);
create index if not exists call_access_grants_session_idx on public.call_access_grants (company_id, session_id);

create table if not exists public.call_access_revocations (
  id bigint generated always as identity primary key,
  grant_id uuid not null references public.call_access_grants(id),
  company_id uuid not null references public.companies(id),
  revoked_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint call_access_revocations_once unique (grant_id)
);

alter table public.call_access_grants enable row level security;
alter table public.call_access_revocations enable row level security;
-- A grantee reads their own grants; admins manage them through /api/coach/remote/[id]/grants (service role).
drop policy if exists rss_call_grants_select on public.call_access_grants;
create policy rss_call_grants_select on public.call_access_grants for select to authenticated
  using (company_id = auth_company_id() and grantee_id = auth.uid());
drop policy if exists rss_call_revocations_select on public.call_access_revocations;
create policy rss_call_revocations_select on public.call_access_revocations for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from public.call_access_grants g where g.id = call_access_revocations.grant_id));
drop policy if exists mfa_required on public.call_access_grants;
create policy mfa_required on public.call_access_grants as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
drop policy if exists mfa_required on public.call_access_revocations;
create policy mfa_required on public.call_access_revocations as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule call_access_grants_no_update as on update to public.call_access_grants do instead nothing;
create or replace rule call_access_grants_no_delete as on delete to public.call_access_grants do instead nothing;
create or replace rule call_access_revocations_no_update as on update to public.call_access_revocations do instead nothing;
create or replace rule call_access_revocations_no_delete as on delete to public.call_access_revocations do instead nothing;

-- The bell: 'call_access_granted' tells the rep (their call was shared) and the grantee (they can open it).
alter table manager_notifications drop constraint if exists manager_notifications_type_check;
alter table manager_notifications
  add constraint manager_notifications_type_check
  check (type in (
    'strong_session',
    'deal_closed',
    'pitch_score_corrected',
    'recording_comment',
    'recording_share_requested',
    'pattern_coached',
    'pattern_clip_disputed',
    'feedback_requested',
    'training_attempted',
    'call_ready',
    'comment_mention',
    'score_disputed',
    'dispute_answered',
    'call_scored',
    'call_access_granted'
  ));

comment on constraint manager_notifications_type_check on manager_notifications is
  'Closed set, and it points BOTH ways: strong_session / deal_closed / pattern_clip_disputed / feedback_requested / '
  'training_attempted / score_disputed go to managers; call_ready, call_scored, dispute_answered and the rest to the rep '
  'they are about; comment_mention to whoever was mentioned; call_access_granted to the rep AND the grantee. A new type '
  'needs a migration extending this list, a decision about what it dedupes to, AND a branch in NotificationBell.';
