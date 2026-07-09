-- 0101 — task_steps UPDATE WITH CHECK (the last sibling of the 0095 tenant-key-push-out class)
--
-- Why
-- ───
-- 0095 (MED-tier UPDATE hardening, 2026-07-07) named the class: an UPDATE policy with
-- `USING` (gating which OLD row) but no `WITH CHECK` (gating the NEW row) lets an
-- authenticated member push a row's tenant key to a FOREIGN value — "push-out vandalism"
-- (a row moved to another tenant with a known foreign key; the FK blocks a garbage id but
-- not a real foreign one). 0095 added `WITH CHECK` mirroring `USING` across the MED-tier.
--
-- An A29 sweep of that class (2026-07-09 — mine a fix, sweep its siblings) found the audit +
-- 0095 covered everything EXCEPT `task_steps`. The other UPDATE-no-WITH-CHECK tables are
-- protected a different, stronger way — pre-existing immutable/preserve triggers that FREEZE
-- the tenant key: files/team_invitations/chat_topics/chat_topic_decisions/departments all
-- freeze `company_id` (team_invitations additionally freezes `role`+`email`). `task_steps`
-- has NEITHER a `WITH CHECK` NOR a freeze trigger, so its `task_id` (the step's tenant key,
-- via `tasks.company_id`) is mutable: a member could change `task_steps.task_id` to a task in
-- another company (a known foreign task id) and push the step cross-tenant. MED severity — no
-- cross-tenant READ, but a genuine integrity gap, identical in shape to what 0095 closed.
--
-- Fix (mirror 0095): recreate the UPDATE policy with a `WITH CHECK` that MIRRORS the `USING`.
-- A same-company update (OLD row satisfied USING; task_id unchanged, or changed to another
-- task in the SAME company) passes untouched; only a change of `task_id` to a task in a
-- FOREIGN company is blocked. Service-role writes bypass RLS, so pipelines are unaffected.
-- §A12 — DROP IF EXISTS then CREATE, safe to re-run.
--
-- STATUS: UNAPPLIED — founder applies per env (alongside the 0095/0096 authz-audit queue).

drop policy if exists "task_steps - update" on task_steps;
create policy "task_steps - update" on task_steps
  for update using (
    exists (
      select 1
      from tasks t
      join profiles p on p.company_id = t.company_id
      where t.id = task_steps.task_id
        and p.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from tasks t
      join profiles p on p.company_id = t.company_id
      where t.id = task_steps.task_id
        and p.id = auth.uid()
    )
  );
