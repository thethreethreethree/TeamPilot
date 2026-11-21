-- 0275_rss_p4_coaching.sql
-- ELOSTATE Remote Sales System - Phase 4: the coaching loop (F16.1, F16.4, F16.10).
-- What COUNTS as feedback is D8 and lives in code (feedback.ts), computed from rows that
-- already exist. Request "open/closed" is derived from events, not stored - the same pattern
-- disputes use today (readDisputes.ts). So there is no status column here, on purpose.

create table public.feedback_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  requester_id uuid not null references public.profiles(id),
  recipient_id uuid not null references public.profiles(id),
  message text check (length(message) <= 2000),
  created_at timestamptz not null default now()
);
create index feedback_requests_recipient_idx on public.feedback_requests (recipient_id, created_at desc);

create table public.listen_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  listener_id uuid not null references public.profiles(id),
  rep_id uuid not null references public.profiles(id),
  from_ms integer not null check (from_ms >= 0),
  to_ms integer not null,
  created_at timestamptz not null default now(),
  check (to_ms > from_ms)
);
create index listen_events_listener_idx on public.listen_events (listener_id, created_at);

alter table public.feedback_requests enable row level security;
alter table public.listen_events enable row level security;

-- A rep asks for feedback on their OWN session, from someone above them in the tree.
create policy rss_fr_insert on public.feedback_requests for insert to authenticated
  with check (
    requester_id = auth.uid()
    and rss_session_rep(session_id) = auth.uid()
    and rss_is_below(recipient_id, auth.uid())
    and company_id = rss_company_of(auth.uid())
  );
create policy rss_fr_select on public.feedback_requests for select to authenticated
  using (requester_id = auth.uid() or recipient_id = auth.uid() or rss_can_view_rep(auth.uid(), requester_id));
-- Deliberately NO update/delete: a request is a fact; closing is derived from later events.

-- A person records only their own listening, and only on sessions they may see.
create policy rss_listen_insert on public.listen_events for insert to authenticated
  with check (
    listener_id = auth.uid()
    and rep_id = rss_session_rep(session_id)
    and rss_can_view_rep(auth.uid(), rep_id)
  );
-- Visible to the listener and to anyone above the listener (manager metrics measure managers).
create policy rss_listen_select on public.listen_events for select to authenticated
  using (listener_id = auth.uid() or rss_can_view_rep(auth.uid(), listener_id));
