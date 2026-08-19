-- 0230 — enforce RQ6 at the schedule_event TABLE (completes 0227) + restrict schedule reads to managers.
--
-- CRITICAL follow-up to 0227: `append_schedule_event` was gated for role, but schedule_event had a single
-- `for all` RLS policy scoped only by company AND `authenticated` holds a direct INSERT grant — so a non-admin
-- member could `POST /rest/v1/schedule_event {type:'TIMEOFF_APPROVED', company_id:<own>}` DIRECTLY, bypassing
-- the RPC and its RQ6 check entirely (confirmed live). Gating only the RPC is insufficient; RQ6 must live on
-- the table's INSERT policy. (Founder chose "enforce RQ6 in the RPC" over "revoke + service-role"; this keeps
-- the RPCs as security-invoker and closes the direct-insert path at the table.)
--
-- Plus (founder pick 2026-08-20): restrict schedule READS to managers — the "manager-only" visibility was
-- UI-only, but the SELECT policies were company-scoped, so a member could read schedule data (incl. sick
-- TIMEOFF_REQUESTED) via a direct GET. No current UI needs member reads (all schedule UI is manager-gated);
-- Phase 6 will add its own per-person member read when built.
--
-- schedule_event: drop the ALL policy → manager-only SELECT + an RQ6 INSERT check (employee types open to
-- members; manager-only types require CEO/COO/admin). UPDATE/DELETE get NO policy (denied by default; the
-- append-only trigger 0220 is the belt-and-braces). schedule_employee: tighten its SELECT (from 0229) to
-- managers; its admin INSERT/UPDATE/DELETE (0229) are unchanged.

-- ── schedule_event ──────────────────────────────────────────────────────────
drop policy if exists "schedule_event tenant" on schedule_event;

create policy "schedule_event read" on schedule_event
  for select using (auth_is_schedule_manager(company_id));

create policy "schedule_event insert" on schedule_event
  for insert with check (
    company_id = auth_company_id()
    and (
      -- Employee-open types (members may append these — Phase-6 self-service). The COMPLEMENT is the RQ6
      -- manager-only set: KEEP IN SYNC with MANAGER_ONLY_EVENT_TYPES (events/route.ts) + 0227 (the RPC).
      type not in (
        'SHIFT_DEFINED', 'SHIFT_PUBLISHED', 'SHIFT_UNPUBLISHED', 'SHIFT_CANCELLED',
        'EMPLOYEE_ASSIGNED', 'EMPLOYEE_UNASSIGNED',
        'TIMEOFF_APPROVED', 'TIMEOFF_DENIED',
        'COVERAGE_REQ_DEFINED', 'COVERAGE_REQ_CHANGED', 'COVERAGE_REQ_REMOVED',
        'SWAP_APPROVED'
      )
      or auth_is_schedule_manager(company_id)
    )
  );

-- ── schedule_employee ───────────────────────────────────────────────────────
-- Tighten the read from company-scoped (0229) to manager-only; writes stay admin-only (0229).
drop policy if exists "schedule_employee read" on schedule_employee;
create policy "schedule_employee read" on schedule_employee
  for select using (auth_is_schedule_manager(company_id));
