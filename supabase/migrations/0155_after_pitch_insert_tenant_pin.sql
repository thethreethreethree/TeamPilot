-- 0155 — Security fix: after_pitch_summaries INSERT must pin the tenant AND the session.
--
-- Bug (found by sweeping every insert/all WITH CHECK for tenant pinning — the INSERT-side analogue of
-- the files_update trap fixed by 0154). The policy (0080) is:
--
--     for insert with check ( agent_id = auth.uid() );
--
-- The author's stated intent was "a manager cannot mint someone else's private summary — agent_id must
-- equal the caller", and that part works. But the check pins ONLY the agent. It constrains neither:
--
--   • company_id — the table HAS `company_id uuid not null references companies(id)`, so a caller can
--     insert a row tagged with ANOTHER company's id (agent_id is still themselves, so the check passes).
--   • session_id — a caller can attach their summary to any coaching session, including one they do not
--     own, or one belonging to another company.
--
-- This is the gap `0082_coaching_insert_owner_scope` closed for coaching_cues and
-- coaching_transcript_segments (it made their INSERT check require the parent session be the caller's).
-- That sweep did not reach after_pitch_summaries, which is the ONLY table in this group that also
-- carries a company_id — so it is the only one where the tenant itself can be forged.
--
-- Severity: LOW, stated plainly and not inflated:
--   • The SELECT policy is owner-only — `using (agent_id = auth.uid())` (0080:131), NOT company-scoped —
--     so a row forged with company_id = X is INVISIBLE to company X. There is no content injection into
--     their UI, no read-escape, and no data exfiltration.
--   • It requires knowing the target company's UUID, which the product does not expose.
--   • The real harm is data pollution / measurement integrity: a foreign-tagged row sits in the table and
--     would be miscounted by any company-level aggregate over after_pitch_summaries.
-- It is still a genuine breach of write-side tenant isolation: no caller should ever be able to write a
-- row stamped with another company's id.
--
-- Fix: pin all three — the agent (as before), the tenant, and the parent session (which must be the
-- caller's own AND in the caller's company). This aligns after_pitch_summaries with the 0082 pattern and
-- adds the company pin that 0082's tables did not need (they have no company_id column).
--
-- Legitimate flow is unchanged: a rep generating their own summary for their own session, in their own
-- company, satisfies every conjunct. The service-role generator bypasses RLS and is unaffected.
--
-- Idempotent (drop policy if exists + create). No data change. Scope: this one policy.
--
-- NOT verified against a live DB by the agent (no DB access) — after applying, smoke-test: (1) a rep can
-- still generate/insert their own after-pitch summary for their own session; (2) inserting a row with a
-- foreign company_id or a session the caller does not own now fails.

drop policy if exists "after_pitch_summaries - insert owner" on after_pitch_summaries;
create policy "after_pitch_summaries - insert owner" on after_pitch_summaries
  for insert with check (
    -- The rep generates their OWN summary (unchanged intent from 0080).
    agent_id = auth.uid()
    -- Tenant pin: the row may not be stamped with another company's id.
    and company_id = auth_company_id()
    -- Session pin: the summary must hang off a session the caller owns, in the caller's company
    -- (the scoping 0082 introduced for coaching_cues / coaching_transcript_segments).
    and exists (
      select 1 from coaching_sessions s
      where s.id = after_pitch_summaries.session_id
        and s.agent_id = auth.uid()
        and s.company_id = auth_company_id()
    )
  );
