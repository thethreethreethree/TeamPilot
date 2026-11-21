-- 0277_rss_p7_training.sql
-- ELOSTATE Remote Sales System - Phase 7: training.
-- Stored, reusable scenarios (F17.3) and assignments with due dates (F17.10).
-- Voice role-play and scoring practice with the pitch rubric are D9 (NOT DECIDED): nothing here
-- assumes either. Practice results keep flowing through the existing coach.practice_scored event.
-- The manager notification on submission (F17.11) needs a new manager_notifications type; the
-- live check constraint (0242:78) allows only 'strong_session' and 'deal_closed' - extend it in a
-- reviewed migration after reading 0242, not here.

create table public.training_scenarios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  title text not null check (length(trim(title)) > 0),
  persona text not null,
  situation text not null,
  channel text not null check (channel in ('door', 'phone', 'video')),
  difficulty text not null check (difficulty in ('easy', 'intermediate', 'advanced')),
  length_min smallint not null check (length_min between 2 and 30),
  pass_score smallint check (pass_score between 0 and 100),  -- null = no pass mark for this scenario
  source_session_id uuid references public.coaching_sessions(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  scenario_id uuid not null references public.training_scenarios(id),
  rep_id uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (scenario_id, rep_id)
);

alter table public.training_scenarios enable row level security;
alter table public.training_assignments enable row level security;
create policy rss_scen_select on public.training_scenarios for select to authenticated
  using (company_id = rss_company_of(auth.uid()));
create policy rss_scen_insert on public.training_scenarios for insert to authenticated
  with check (company_id = rss_company_of(auth.uid()) and rss_is_manager(auth.uid()) and created_by = auth.uid()
              and (source_session_id is null or rss_can_view_rep(auth.uid(), rss_session_rep(source_session_id))));
create policy rss_assign_select on public.training_assignments for select to authenticated
  using (rep_id = auth.uid() or rss_can_view_rep(auth.uid(), rep_id));
create policy rss_assign_insert on public.training_assignments for insert to authenticated
  with check (assigned_by = auth.uid() and rss_is_manager(auth.uid()) and auth.uid() <> rep_id
              and rss_can_view_rep(auth.uid(), rep_id) and company_id = rss_company_of(auth.uid()));
create policy rss_assign_update on public.training_assignments for update to authenticated
  using (assigned_by = auth.uid() or rss_is_below(auth.uid(), rep_id)) with check (rss_can_view_rep(auth.uid(), rep_id));
-- Deliberately NO policy lets a rep change their own due date.
