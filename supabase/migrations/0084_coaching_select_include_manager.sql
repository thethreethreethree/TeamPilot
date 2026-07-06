-- 0084_coaching_select_include_manager.sql
--
-- Widen the 0083 SELECT (read) policies to include the Sales-Coach MANAGER, per
-- the founder's decision 2026-07-06 ("Manager and admin can be treated with the
-- same access"). 0083 granted cross-rep read to company admins only
-- (role in CEO/COO/admin); this adds sales_coach_role = 'admin' so a Sales-Coach
-- manager who is NOT a company officer gets the SAME oversight read.
--
-- WHY a new migration, not an edit to 0083: 0083 is already applied. Editing an
-- applied migration in place would drift the file from the deployed DB (the
-- migration-coupling failure mode the team has hit before). This forward
-- migration reaches the intended end state whether or not 0083 is re-run.
--
-- CONSISTENCY (§A21 — one manager definition): this makes the read-set identical
-- to the predicate team-analytics/route.ts already enforces for the manager
-- aggregates:
--     isCompanyAdmin = role in ('CEO','COO','admin')
--     isManager      = isCompanyAdmin OR sales_coach_role = 'admin'
-- So individual-session read (this RLS) and team aggregates (service-role route)
-- now recognise the same set of managers. No rep gains peer read — the owner
-- branch is unchanged; only the manager branch widens.
--
-- BLAST RADIUS (re-traced): unchanged from 0083. Team analytics is service-role
-- (bypasses this RLS); the agent dashboard reads own agent_id (owner branch);
-- session-operation routes rely on this RLS and handle a null session. Reads
-- degrade to owner-or-company-admin if this isn't applied — strictly safer,
-- never broader — so there is no migration-coupling risk (§A19/§A22).
--
-- Idempotent (§A12): drop-if-exists + recreate.

-- coaching_sessions: owner, or a company admin OR sales-coach manager (same co).
drop policy if exists "coaching_sessions - select" on coaching_sessions;
create policy "coaching_sessions - select" on coaching_sessions
  for select using (
    coaching_sessions.agent_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = coaching_sessions.company_id
        and (p.role in ('CEO', 'COO', 'admin') or p.sales_coach_role = 'admin')
    )
  );

-- coaching_transcript_segments: readable iff you may read the parent session.
drop policy if exists "coaching_transcript_segments - select" on coaching_transcript_segments;
create policy "coaching_transcript_segments - select" on coaching_transcript_segments
  for select using (
    exists (
      select 1 from coaching_sessions s
      where s.id = coaching_transcript_segments.session_id
        and (
          s.agent_id = auth.uid()
          or exists (
            select 1 from profiles p
            where p.id = auth.uid()
              and p.company_id = s.company_id
              and (p.role in ('CEO', 'COO', 'admin') or p.sales_coach_role = 'admin')
          )
        )
    )
  );

-- coaching_cues: same rule as segments (readable iff the parent session is).
drop policy if exists "coaching_cues - select" on coaching_cues;
create policy "coaching_cues - select" on coaching_cues
  for select using (
    exists (
      select 1 from coaching_sessions s
      where s.id = coaching_cues.session_id
        and (
          s.agent_id = auth.uid()
          or exists (
            select 1 from profiles p
            where p.id = auth.uid()
              and p.company_id = s.company_id
              and (p.role in ('CEO', 'COO', 'admin') or p.sales_coach_role = 'admin')
          )
        )
    )
  );
