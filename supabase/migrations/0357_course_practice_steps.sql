-- 0357 — practice steps in training courses (2026-11-26; Gong ledger F17.1 "lessons and practices"). Idempotent (A12).
--
-- A course step is now a LESSON (text the rep reads and marks done, 0355) or a PRACTICE: one of the company's practice
-- scenarios (0282). A practice step is done when the rep's practice of that scenario counts as done — the existing
-- training_assignments / training_attempts decide it (training.ts assignmentStatus), so there is one verdict, not a
-- second "done" flag (§2.2). Giving a rep a course also gives them its practice scenarios, with the course's due date.
-- A practice step's text is an optional note from the manager.

alter table public.training_course_steps add column if not exists scenario_id uuid references public.training_scenarios(id);
alter table public.training_course_steps drop constraint if exists training_course_steps_kind_check;
alter table public.training_course_steps drop constraint if exists training_course_steps_body_check;
alter table public.training_course_steps drop constraint if exists training_course_steps_kind_shape;
alter table public.training_course_steps add constraint training_course_steps_kind_shape check (
  (kind = 'lesson' and scenario_id is null and length(trim(body)) between 1 and 4000)
  or (kind = 'practice' and scenario_id is not null and length(body) <= 4000)
);
