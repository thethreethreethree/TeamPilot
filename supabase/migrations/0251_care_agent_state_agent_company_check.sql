-- 0251 — close a cross-tenant WRITE hole in care_agent_state (CARE agent routing/presence).
--
-- FINDING (2026-09-12 audit — sibling of the rep_daily_sales_goal hole fixed in 0250; same class as F34/F35 /
-- 0a157677): the 0042 "care_agent_state - admin insert" policy checks the caller is an admin in the ROW's company
-- (p.company_id = care_agent_state.company_id) but NEVER that agent_id (the row's PK, a person, → profiles) belongs
-- to that company. So a CEO/COO/admin in company A could INSERT a routing-state row for a foreign agent in company
-- B (stamped company A); the "agent_id = auth.uid()" SELECT clause then surfaces it to agent B. INSERT-only — PK is
-- agent_id, so a foreign agent who already has a row conflicts; and the admin UPDATE is already safe (its USING
-- pins the existing row's company). Within-tenant blast radius is routing presence (status/capacity/channels), not
-- PII/financial — LOW-MED — but it is a real instance of the class, so close it.
--
-- FIX: add "the target agent is a profile in the row's company" to the admin-insert WITH CHECK. Everything else is
-- copied verbatim from 0042. Additive + idempotent (drop/create). No data change. Apply via `npm run db:apply`.
-- (RLS-only fix: unlike rep_daily_sales_goal there is no shared route guard added here — the hole is the direct
-- PostgREST insert path, which RLS is the correct and sufficient control for; it takes effect once 0251 applies.)

drop policy if exists "care_agent_state - admin insert" on care_agent_state;
create policy "care_agent_state - admin insert" on care_agent_state
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = care_agent_state.company_id
        and p.role in ('CEO', 'COO', 'admin')
    )
    -- NEW: the target agent must belong to the row's company — blocks an admin stamping a routing row onto a
    -- foreign agent. (a.company_id = row.company_id, combined with the admin-in-row.company check above, means the
    -- agent is in the caller's own company.)
    and exists (
      select 1 from profiles a
      where a.id = care_agent_state.agent_id
        and a.company_id = care_agent_state.company_id
    )
  );
