-- 0112 — item-12 (HIGH): close company-wide prompt injection + brain-audit fabrication
--        by privileging the sanctioned write paths, then restricting direct member writes.
--
-- ⚠️ UNAPPLIED — STAGING RUNTIME TEST REQUIRED BEFORE PROMOTE. ⚠️
-- This is the ONE migration this window that changes function SECURITY MODE (invoker →
-- definer). Unlike 0101-0111 (pure RLS tightening I verified breaks no path), a DEFINER
-- flip changes WHO the function runs as, and the learning cycle / brain auto-create run
-- THROUGH these functions. The static safety is verified (below); the runtime semantics
-- are standard but MUST be confirmed live. DO NOT promote to prod until you have, on
-- staging: (1) created a test company (auto-brain trigger fires), (2) run a full learning
-- cycle (record_brain_learning writes), (3) confirmed the brain still composes into AI
-- calls. See docs/AUDIT-2026-07-09-brain-injection.md for the full framing.
--
-- AFTER applying (before the behavioral test), run the shape verifier:
--   docs/closures/2026-07-09-item12-0112-staging-verification.sql  (read-only, PASS/FAIL per object).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE FINDING (verified from source 2026-07-09)
-- ─────────────────────────────────────────────────────────────────────────────
-- company_brain.system_prompt_addendum is injected into EVERY LLM system prompt for a
-- company (composeSystemPrompt, brain/index.ts). Its RLS is a single company-scoped
-- "for all" policy (0007:114) with NO role gate and NO column constraint, so any
-- authenticated member can:
--     UPDATE company_brain SET system_prompt_addendum = '<arbitrary instructions>'
--     WHERE company_id = <their company>;
-- …and that text is prepended to every AI call the company makes — INCLUDING the
-- customer-facing C.A.R.E replies. Company-wide prompt injection by any member, and it
-- bypasses the append-only brain_evolution_events audit (§3.1). Sibling: members can
-- INSERT fabricated brain_evolution_events rows (fake "learning" audit entries).
--
-- WHY A ROLE-GATE ALONE (like 0111) DOESN'T WORK: the sanctioned path
-- record_brain_learning is SECURITY INVOKER (0007:149), so the legit learning cycle
-- writes company_brain AS THE MEMBER — members currently NEED direct write for the real
-- feature. So we can't just deny member writes; we must first privilege the sanctioned
-- path (make it DEFINER so it writes regardless of the member's table grant), THEN deny
-- direct member writes at the RLS layer.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- STATIC SAFETY — verified headless 2026-07-09 (the part I CAN confirm without a live DB)
-- ─────────────────────────────────────────────────────────────────────────────
-- Every write to these two tables already goes through a path this migration privileges:
--   • company_brain: grep of src found the ONLY direct app access is a READ
--     (brain/index.ts:36 `.from("company_brain").select(...)` for composeSystemPrompt).
--     Writes come from record_brain_learning (RPC; brain/index.ts:143, learn.ts×5) and the
--     create_empty_brain_for_company trigger. No direct member write path exists to break.
--   • brain_evolution_events: zero direct app writes (only record_brain_learning inserts it).
--   • record_brain_learning already SELF-SCOPES every read/write by
--     `where company_id = auth_company_id()` (0007:162,207), so under DEFINER (RLS bypassed)
--     the explicit predicates still confine it to the caller's company — no cross-tenant leak.
-- RESIDUAL (needs the staging test): auth.uid()/auth_company_id() read the session JWT, not
-- the definer's identity, so they still resolve to the CALLER under DEFINER (standard
-- Supabase). The function relies on this — confirm it live before promoting.
--
-- §A12 idempotent (drop-if-exists before each create; create-or-replace is inherently so).

-- ── 1. Privilege the sanctioned write paths (invoker → definer), pin search_path (per 0096).
--     Signature copied EXACTLY from 0007:135-146 so ALTER targets the right overload.
alter function record_brain_learning(
  text, text, text, text, text, jsonb, jsonb, jsonb, uuid[], uuid[]
) security definer set search_path = public;

-- The auto-create trigger must also not depend on the inserter's (soon-removed) RLS grant.
alter function create_empty_brain_for_company()
  security definer set search_path = public;

-- ── 2. Restrict company_brain to SELECT for members; deny direct INSERT/UPDATE.
--     (The DEFINER paths above still write; 0108 company_brain_no_delete blocks DELETE.)
drop policy if exists "company_brain - all" on company_brain;
drop policy if exists "company_brain - select" on company_brain;
create policy "company_brain - select" on company_brain
  for select using (company_id = auth_company_id());
-- No INSERT/UPDATE policy → member direct writes default-denied. This is what closes the
-- prompt-injection vector: a member can no longer UPDATE system_prompt_addendum directly.

-- ── 3. Same treatment for brain_evolution_events (the append-only audit table).
--     Only record_brain_learning (now DEFINER) inserts it; the 0007 no-update/no-delete
--     rules keep it append-only regardless of RLS. Restricting to SELECT closes the
--     fabricate-fake-audit-entry vector while the sanctioned path still writes.
drop policy if exists "brain_evolution_events - all" on brain_evolution_events;
drop policy if exists "brain_evolution_events - select" on brain_evolution_events;
create policy "brain_evolution_events - select" on brain_evolution_events
  for select using (company_id = auth_company_id());
