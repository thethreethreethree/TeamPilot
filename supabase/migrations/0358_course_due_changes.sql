-- 0358 — moving a course's due date (2026-11-26; Gong ledger F17.1). Idempotent (A12).
--
-- As 0282's training_due_changes: a manager moving a course's due date is a ROW, never an edit to the assignment (§3.1);
-- the current due date is the latest row, else the assignment's own. Written by the course-assignments route after the
-- manager and reporting-tree checks; read by the rep it belongs to and by managers the 0273 tree allows (through the
-- assignment's own policy). Carries the 0309 mfa_required policy from the start (the 0355/0356 lesson).

create table if not exists public.training_course_due_changes (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id),
  assignment_id uuid not null references public.training_course_assignments(id),
  due_at timestamptz not null,
  changed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists training_course_due_changes_assignment_idx on public.training_course_due_changes (assignment_id, id);
alter table public.training_course_due_changes enable row level security;
drop policy if exists training_course_due_changes_select on public.training_course_due_changes;
create policy training_course_due_changes_select on public.training_course_due_changes for select to authenticated
  using (company_id = auth_company_id() and exists (select 1 from training_course_assignments a where a.id = training_course_due_changes.assignment_id));
drop policy if exists mfa_required on public.training_course_due_changes;
create policy mfa_required on public.training_course_due_changes as restrictive for all to authenticated
  using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()));
create or replace rule training_course_due_changes_no_update as on update to public.training_course_due_changes do instead nothing;
create or replace rule training_course_due_changes_no_delete as on delete to public.training_course_due_changes do instead nothing;
