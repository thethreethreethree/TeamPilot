-- 0102 — coaching_sessions UPDATE WITH CHECK (2nd + final sibling of the 0095 push-out class)
--
-- Why
-- ───
-- Same class as 0095 / 0101 (an UPDATE policy with USING but no WITH CHECK lets a member push a
-- row's tenant/authz key to a foreign value). The A29 sweep of this class found task_steps (0101)
-- AND coaching_sessions. coaching_sessions is the HIGHER-consequence one and was missed by both
-- the 2026-07-07 authz audit (0090-0096) and the freeze-trigger set — it has NEITHER a WITH CHECK
-- NOR an immutable trigger.
--
-- Its UPDATE policy (0070:153):
--   using (exists (select 1 from profiles p where p.id = auth.uid()
--                    and p.company_id = coaching_sessions.company_id
--                    and (coaching_sessions.agent_id = p.id or p.role in ('CEO','COO','admin'))))
-- With no WITH CHECK, the NEW row's `company_id` and `agent_id` are unchecked:
--   • `agent_id` push — the session OWNER could change agent_id to ANOTHER agent, reassigning the
--     session into that agent's ELO computation (getAgentEloGames reads sessions by agent_id) →
--     skews a peer's rating. Same §3.5 integrity concern as the outcome-gating flag (item 3), but
--     here it needs no manager access at all — the owner does it to their own row.
--   • `company_id` push — cross-tenant relocation with a known foreign company id (FK blocks a
--     garbage id, not a real foreign one).
--
-- Fix (mirror USING in WITH CHECK): a same-owner update with unchanged keys passes; an owner
-- changing agent_id to a peer FAILS the check (NEW agent_id ≠ caller, caller not admin); an ADMIN
-- reassign still passes (the role branch) — that legitimate admin capability is preserved; a
-- cross-tenant company_id change FAILS (NEW company_id must equal the caller's). Service-role
-- pipelines bypass RLS. §A12 idempotent.
--
-- Correction to 0101: 0101's note called task_steps "the SOLE/last sibling" — that was premature
-- (the boundary wasn't finished; coaching_sessions + widget-logos were unchecked). Now complete:
-- widget-logos was covered by 0093; coaching_sessions (this migration) is the genuine 2nd gap.
--
-- STATUS: UNAPPLIED — founder applies alongside the 0095/0096/0101 authz queue.

drop policy if exists "coaching_sessions - update" on coaching_sessions;
create policy "coaching_sessions - update" on coaching_sessions
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = coaching_sessions.company_id
        and (coaching_sessions.agent_id = p.id or p.role in ('CEO', 'COO', 'admin'))
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = coaching_sessions.company_id
        and (coaching_sessions.agent_id = p.id or p.role in ('CEO', 'COO', 'admin'))
    )
  );
