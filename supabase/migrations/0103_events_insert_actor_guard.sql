-- 0103 — events INSERT: constrain `actor` to self-or-system (block actor spoofing)
--
-- Why
-- ───
-- The `events - all` policy (0004:42) gates INSERT with ONLY `company_id = auth_company_id()`
-- — no constraint on `actor`. So an authenticated member can, via a direct PostgREST INSERT,
-- write an event attributed to ANY same-company user (`actor = <victim>`). events is the
-- foundation of THREE derived systems, and actor-spoofing pollutes all of them:
--   • §3.5 ELO — `getAgentEloGames` reads `coach.dissect_generated` events by `actor = agentId`.
--     A fabricated dissect (actor = victim, all growth_areas / no strengths) skews the victim's
--     rating. This is the actor-side twin of the coaching_sessions/agent_id gap (0102) and the
--     outcome-gating flag (item 3) — the same ELO-integrity class, via a third input.
--   • §3.1 chain — events → signals → problems → resolutions. A fabricated `problem.resolved` /
--     `task.blocker_recorded` (actor = victim) injects false signals + false attribution.
--   • the brain — the learning cycle reads the chain; polluted events teach a polluted model.
--
-- Found by an A29 ELO-integrity sweep (2026-07-09): after_pitch_summaries INSERT is already
-- owner-scoped (`with check (agent_id = auth.uid())`, 0080) — the events actor was the open input.
--
-- Why the fix is safe (verified before applying, §0)
-- ──────────────────────────────────────────────────
-- Every LEGITIMATE user-reachable insert already sets actor to self or system:
--   • record_event() (0004:53) is SECURITY INVOKER and hard-codes `actor := auth.uid()`.
--   • The SECURITY INVOKER emit triggers (0015 chat, 0100 resolutions, 0006 tasks via
--     record_event) all use auth.uid().
--   • App routes insert with actor = auth.user.id (self) or actor = null (system/customer).
-- SECURITY DEFINER emit functions (e.g. 0054 durability-due, actor null) and service-role
-- writes BYPASS RLS entirely, so this WITH CHECK never applies to them. So constraining the
-- user-reachable INSERT to `actor = auth.uid() OR actor is null` breaks nothing and closes the
-- spoof. (SELECT stays company-wide — the chain is meant to be company-readable; UPDATE/DELETE
-- remain no-ops via the events_no_update / events_no_delete rules from 0004.)
--
-- §A12 idempotent. STATUS: UNAPPLIED — founder applies alongside the authz queue.

drop policy if exists "events - all" on events;
create policy "events - all" on events
  for all
  using (company_id = auth_company_id())
  with check (
    company_id = auth_company_id()
    and (actor = auth.uid() or actor is null)
  );
