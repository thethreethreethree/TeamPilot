-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0355 — Training courses: ordered lessons a manager writes and assigns (2026-11-26; Gong ledger F17.1). Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
--   training_courses — a named course with a short summary. Never edited; retired once (retired_at), like a scenario
--     (0282), so a rep's progress keeps meaning.
--   training_course_steps — the course's lessons, in order. Saving a course writes a whole NEW VERSION of its steps
--     (§3.1: rows are appended, never edited); the current course is its highest version. Each step keeps a step_uid
--     across versions, so a rep's "done" survives a reorder or a reworded lesson.
--   training_course_assignments — a course given to a rep with a due date (one per course and rep).
--   training_step_completions — a rep marking a lesson done: one row per assignment and step_uid.
--
-- Placement: D18 (decided 2026-11-23) keeps training in Remote Sales → Training. No client write policies — the routes
-- write after their own checks (manager, reporting tree, company), as in 0282. Read rules: courses and steps company-
-- wide; assignments and completions the rep's own or a manager's under the 0273 tree. No customer data is stored.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'rss_tree_allows') then
    raise exception 'training courses preflight: rss_tree_allows() not found — apply 0273 first';
  end if;
end $$;

create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  title text not null check (length(trim(title)) between 1 and 120),
  summary text check (summary is null or length(summary) <= 600),
  created_by uuid not null references public.profiles(id),
  retired_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists training_courses_company_idx on public.training_courses (company_id, created_at desc);
alter table public.training_courses enable row level security;
drop policy if exists training_courses_select on public.training_courses;
create policy training_courses_select on public.training_courses for select to authenticated using (company_id = auth_company_id());
create or replace function public.training_guard_course_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - 'retired_at') is distinct from (to_jsonb(old) - 'retired_at') or old.retired_at is not null then
    raise exception 'A course never changes — save a new version of its lessons, or retire it';
  end if;
  return new;
end $$;
drop trigger if exists training_guard_course_update on public.training_courses;
create trigger training_guard_course_update before update on public.training_courses
  for each row execute function public.training_guard_course_update();
create or replace rule training_courses_no_delete as on delete to public.training_courses do instead nothing;

create table if not exists public.training_course_steps (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  course_id uuid not null references public.training_courses(id),
  version integer not null check (version >= 1),
  position smallint not null check (position between 1 and 50),
  step_uid uuid not null,
  kind text not null default 'lesson' check (kind in ('lesson')),
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null check (length(trim(body)) between 1 and 4000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint training_course_steps_position_once unique (course_id, version, position),
  constraint training_course_steps_uid_once unique (course_id, version, step_uid)
);
create index if not exists training_course_steps_course_idx on public.training_course_steps (course_id, version desc, position);
alter table public.training_course_steps enable row level security;
drop policy if exists training_course_steps_select on public.training_course_steps;
create policy training_course_steps_select on public.training_course_steps for select to authenticated using (company_id = auth_company_id());
create or replace rule training_course_steps_no_update as on update to public.training_course_steps do instead nothing;
create or replace rule training_course_steps_no_delete as on delete to public.training_course_steps do instead nothing;

create table if not exists public.training_course_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  course_id uuid not null references public.training_courses(id),
  rep_id uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint training_course_assignments_once unique (course_id, rep_id)
);
create index if not exists training_course_assignments_rep_idx on public.training_course_assignments (rep_id, due_at);
alter table public.training_course_assignments enable row level security;
drop policy if exists training_course_assignments_select on public.training_course_assignments;
create policy training_course_assignments_select on public.training_course_assignments for select to authenticated
  using (company_id = auth_company_id() and (rep_id = auth.uid() or (is_sales_coach_manager() and rss_tree_allows(rep_id))));
create or replace rule training_course_assignments_no_update as on update to public.training_course_assignments do instead nothing;
create or replace rule training_course_assignments_no_delete as on delete to public.training_course_assignments do instead nothing;

create table if not exists public.training_step_completions (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  assignment_id uuid not null references public.training_course_assignments(id),
  step_uid uuid not null,
  rep_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint training_step_completions_once unique (assignment_id, step_uid)
);
create index if not exists training_step_completions_assignment_idx on public.training_step_completions (assignment_id);
alter table public.training_step_completions enable row level security;
drop policy if exists training_step_completions_select on public.training_step_completions;
create policy training_step_completions_select on public.training_step_completions for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from training_course_assignments a where a.id = training_step_completions.assignment_id));
create or replace rule training_step_completions_no_update as on update to public.training_step_completions do instead nothing;
create or replace rule training_step_completions_no_delete as on delete to public.training_step_completions do instead nothing;
