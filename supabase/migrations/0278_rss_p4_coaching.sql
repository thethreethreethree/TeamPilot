-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0278 — RSS Phase 4: the coaching loop (scaffold 0275_rss_p4_coaching.sql, renumbered; Gong F16.1, F16.4, F16.10)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
--   feedback_requests — a rep asks for feedback on their own phone/video session. A request is a fact: no status
--     column, no update, no delete. Open/closed is DERIVED from later manager actions on that session
--     (src/lib/coach/remote/feedback.ts), the same replay pattern disputes use (readDisputes.ts).
--   listen_events — one row per stretch of a recording someone played. What counts as "listened" is D8
--     (NOT DECIDED); the ranges are recorded either way, so deciding D8 later loses nothing.
--
-- DIFFERENCES FROM THE SCAFFOLD, AND WHY
--   · recipient_id is NULLABLE. The scaffold required one, but a rep with no manager set (every company before
--     its reporting tree is complete — 0273) has nobody to name. Null = "my managers": every manager who may see
--     the rep (rss_tree_allows) sees it. Inventing a recipient would route a request to the wrong person.
--   · No client insert policies. Both tables are written by routes after their own checks (the pattern every RSS
--     table follows — 0276, 0277), so the rule lives in one place (§2.2). The scaffold's insert policies called
--     rss_session_rep / rss_company_of, which this schema never defined.
--   · Read rules reuse the session's own rule (owner, or a manager under the 0273 tree), not a second copy.
--   · Append-only rules on both (§3.1).
--
-- Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rss_tree_allows') then
    raise exception 'RSS preflight: rss_tree_allows() not found — apply 0273 first';
  end if;
end $$;

create table if not exists public.feedback_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  requester_id uuid not null references public.profiles(id),
  recipient_id uuid references public.profiles(id),   -- null: every manager who may see the requester
  message text check (message is null or length(message) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists feedback_requests_company_idx on public.feedback_requests (company_id, created_at desc);
create index if not exists feedback_requests_session_idx on public.feedback_requests (session_id, created_at);
alter table public.feedback_requests enable row level security;

drop policy if exists rss_fr_select on public.feedback_requests;
create policy rss_fr_select on public.feedback_requests for select to authenticated
  using (
    company_id = auth_company_id()
    and (requester_id = auth.uid() or recipient_id = auth.uid()
         or (is_sales_coach_manager() and rss_tree_allows(requester_id)))
  );
-- No write policies: POST /api/coach/remote/:id/feedback-request writes after checking ownership.
create or replace rule feedback_requests_no_update as on update to public.feedback_requests do instead nothing;
create or replace rule feedback_requests_no_delete as on delete to public.feedback_requests do instead nothing;

create table if not exists public.listen_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  session_id uuid not null references public.coaching_sessions(id) on delete cascade,
  listener_id uuid not null references public.profiles(id),
  rep_id uuid not null references public.profiles(id),
  from_ms integer not null check (from_ms >= 0),
  to_ms integer not null,
  created_at timestamptz not null default now(),
  constraint listen_events_range check (to_ms > from_ms)
);
create index if not exists listen_events_listener_idx on public.listen_events (company_id, listener_id, created_at);
create index if not exists listen_events_session_idx on public.listen_events (session_id);
alter table public.listen_events enable row level security;

-- The listener, and managers who may see the listener (manager metrics measure managers).
drop policy if exists rss_listen_select on public.listen_events;
create policy rss_listen_select on public.listen_events for select to authenticated
  using (
    company_id = auth_company_id()
    and (listener_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(listener_id)))
  );
-- No write policies: POST /api/coach/remote/:id/listen writes after checking the caller can see the session.
create or replace rule listen_events_no_update as on update to public.listen_events do instead nothing;
create or replace rule listen_events_no_delete as on delete to public.listen_events do instead nothing;
