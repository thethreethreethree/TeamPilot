-- 0108 — §3.1 immutability: add no-delete rules to `problems` and `company_brain`
--        (the two append-only tables a member-reachable DELETE policy left deletable).
--
-- Why
-- ───
-- A DELETE-side sweep of the authz boundary (2026-07-09) — prompted by 0105/0107 showing the
-- 2026-07-07 audit had missed UPDATE-side gaps, so its DELETE-side completeness was suspect —
-- found the append-only invariant (§3.1: "events are immutable, never delete — append") has two
-- unguarded holes. Both tables carry a `for all` RLS policy (which grants DELETE) with only a
-- company scope, and neither has the `do instead nothing` DELETE rule their siblings got:
--
--   1. problems (HIGH) — the CENTRE of the §3.1 chain (events → signals → problems → resolutions,
--      0005:4). Its siblings all have no-delete rules: signals_no_delete (0002:38),
--      problem_signals_no_delete (0002:85), resolutions_no_delete (0094). `problems` is the one
--      link left deletable by any company member. Worse, TWO children FK to it ON DELETE CASCADE —
--      problem_signals.problem_id (0002:76) and resolutions.problem_id (0005:26) — and FK cascades
--      are NOT intercepted by the children's `do instead nothing` rules. So a member issuing
--      `DELETE FROM problems WHERE id = X` cascade-wipes that problem's signal links AND its
--      resolutions, DEFEATING resolutions_no_delete (0094) through the back door. This is the
--      immutability breach §3.1 exists to prevent, at the chain's most load-bearing node.
--      Verified: no application path deletes a problem (problems are RESOLVED via a status update
--      in close_problem, never deleted), so a no-delete rule breaks nothing.
--
--   2. company_brain (MED) — the per-company brain singleton (pk = company_id). Its schema states
--      record_brain_learning() is "the only sanctioned path to mutate the brain" (0007:123), and
--      its sibling brain_evolution_events already has a no-delete rule (0007:104) — but the
--      singleton itself is member-deletable via `company_brain - all` (0007:114). No application
--      path deletes it. A non-admin wiping the whole learned model is a data-integrity /
--      §3.6-learning-visibility loss; no-delete is the correct guard.
--
-- NOT included (boundary by reachability/intent, per the A26 addendum, not by pattern):
--   • `decisions` matched the same for-all-deletable shape BUT has a LEGITIMATE delete path
--     (decisions/route.ts:103 deletes a decision by id) — it is a MUTABLE entity, not an
--     append-only chain table, so a no-delete rule would break the app. Its delete SCOPE
--     (company-wide vs owner/admin-only) is a permission-model question for the founder, not an
--     immutability breach — flagged in the closure doc, not fixed here.
--   • `team_members` delete-scope (non-admin can remove a teammate) is likewise a permission-model
--     decision, flagged, not unilaterally changed (§2 surface-don't-overtake).
--
-- Mechanism note: `do instead nothing` on DELETE makes a direct member delete a silent no-op
-- (0 rows) — identical to how events/signals/resolutions already behave (§3.1 by design). It does
-- NOT block FK cascade from a legitimate parent teardown (e.g. company deletion by service-role),
-- which correctly cascades. §A12 idempotent (create-or-replace rule). STATUS: UNAPPLIED — founder
-- applies alongside the 0102-0107 authz queue.

create or replace rule problems_no_delete as
  on delete to problems do instead nothing;

create or replace rule company_brain_no_delete as
  on delete to company_brain do instead nothing;
