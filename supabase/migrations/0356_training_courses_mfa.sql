-- 0356 — the multi-factor rule on the training-course tables (2026-11-26). Idempotent (A12).
--
-- 0309 puts a RESTRICTIVE mfa_required policy on every table that grants access, so a session that has not finished
-- multi-factor sign-in reaches nothing. 0355 created four tables without it; verify:live caught it right after the
-- apply ("4 table(s) grant access without mfa_required"). 0355 is applied and in the ledger, so the fix is this new
-- migration, never an edit to that one.

do $$
declare t text;
begin
  foreach t in array array['training_courses', 'training_course_steps', 'training_course_assignments', 'training_step_completions'] loop
    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format('create policy mfa_required on public.%I as restrictive for all to authenticated using ((select public.rss_mfa_ok())) with check ((select public.rss_mfa_ok()))', t);
  end loop;
end $$;
