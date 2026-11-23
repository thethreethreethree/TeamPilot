-- 0321 — when a rep saw the answer to their feedback request (2026-11-23; OPEN.md "an answered feedback request stays a
-- to-do for 7 days even after the rep has read it").
--
-- "Your coaching this week" (routine.ts repRoutineSteps) lists answers to the rep's feedback requests. Without a record
-- of the rep seeing them, an answer stayed a to-do for 7 days after it was read. When the call's own rep opens the call
-- and the page shows "Answered", a row is appended here; an answer counts as new only if it came after the rep's latest
-- view of that call. A fact over time (§3.1): append-only. No words — ids and a time — so legal erasure needs nothing.
-- Re-runnable.

create table if not exists public.feedback_answer_views (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  rep_id uuid not null references public.profiles(id),
  seen_at timestamptz not null default now()
);
create index if not exists feedback_answer_views_rep_idx on public.feedback_answer_views (rep_id, session_id, seen_at desc);
alter table public.feedback_answer_views enable row level security;

-- The rep reads and writes only their own views, of their own calls.
drop policy if exists feedback_answer_views_select on public.feedback_answer_views;
create policy feedback_answer_views_select on public.feedback_answer_views for select to authenticated
  using (company_id = auth_company_id() and rep_id = auth.uid());
drop policy if exists feedback_answer_views_insert on public.feedback_answer_views;
create policy feedback_answer_views_insert on public.feedback_answer_views for insert to authenticated
  with check (company_id = auth_company_id() and rep_id = auth.uid()
              and exists (select 1 from coaching_sessions s where s.id = feedback_answer_views.session_id and s.agent_id = auth.uid()
                                                             and s.company_id = auth_company_id()));
drop policy if exists mfa_required on public.feedback_answer_views;
create policy mfa_required on public.feedback_answer_views as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));

create or replace rule feedback_answer_views_no_update as on update to public.feedback_answer_views do instead nothing;
create or replace rule feedback_answer_views_no_delete as on delete to public.feedback_answer_views do instead nothing;
