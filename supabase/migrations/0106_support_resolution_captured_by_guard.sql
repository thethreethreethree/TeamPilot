-- 0106 — support_resolutions INSERT: constrain `captured_by` to self-or-null
--        (the care-side sibling of the author-spoof class: events 0103 / messages 0104 /
--         resolutions 0105)
--
-- Why
-- ───
-- support_resolutions records "this issue was resolved this way" and feeds the CARE brain
-- (care.ts reads captured_by-scoped resolutions for an agent's precedent history + stats;
-- see care.ts:3182/3187). Its INSERT policy (0036:256) gates the CALLER as an agent/admin in
-- the company but does NOT constrain `captured_by`, so one agent could capture a resolution
-- attributed to ANOTHER agent (`captured_by = <peer>`) — attribution-spoof that skews the
-- peer's captured-resolution history/stats. MED-LOW (trusted same-company staff), same class
-- as 0103/0104/0105.
--
-- Why the fix is safe (verified before applying, §0)
-- ──────────────────────────────────────────────────
-- The only insert path — captureResolution (care.ts:1073, createServerClient / user-scoped) —
-- sets `captured_by = args.capturedBy`, and its sole caller (resolution/route.ts:80) passes
-- `capturedBy: auth.agentId`, where requireCareAgent (careAgentAuth.ts:94) sets
-- `agentId := auth.user.id`. So captured_by is always self. captured_by references profiles(id),
-- which is 1:1 with auth.users(id), so `captured_by = auth.uid()` is the correct self-check.
-- Any trigger/backfill insert is service-role and bypasses RLS. So the constraint passes every
-- legit path and blocks only the spoof.
--
-- This completes the author-spoof class boundary for the HIGH/MED-consequence surfaces (those
-- feeding ELO, the §3.1 chain, the brains, or communication-surface impersonation): events.actor
-- (0103), chat/support_messages.author_id (0104), resolutions.decided_by/reviewer (0105),
-- support_resolutions.captured_by (this). Remaining authorship columns (entity created_by /
-- opened_by / invited_by / added_by) are audit/display attribution, lower consequence, and
-- several are freeze-protected (0096) — bounded, not silently ignored (see the closure doc).
--
-- §A12 idempotent. STATUS: UNAPPLIED — founder applies alongside the 0103/0104/0105 authz queue.

drop policy if exists "support_resolutions - insert" on support_resolutions;
create policy "support_resolutions - insert" on support_resolutions
  for insert with check (
    (captured_by = auth.uid() or captured_by is null)
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.company_id = support_resolutions.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );
