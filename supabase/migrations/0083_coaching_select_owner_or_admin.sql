-- 0083_coaching_select_owner_or_admin.sql
--
-- Complete the Live Sales Coach (0070) RLS hardening: tighten the SELECT (read)
-- policies from COMPANY-WIDE to OWNER-OR-COMPANY-ADMIN. Founder decision
-- 2026-07-06 ("Owner + full manager read"): a rep may read ONLY their own
-- sessions / transcripts / cues; a company admin (CEO / COO / admin) may read
-- any rep's, for coaching oversight. Reps cannot read peers.
--
-- WHY. 0070's SELECT policies allowed any same-company member to read any
-- colleague's full call transcripts via direct PostgREST (anon key + a
-- logged-in user's JWT) — a §A18 over-share of personal coaching data,
-- inconsistent with the owner-scoped model 0080 already established
-- (after_pitch_summaries / coaching_cue_outcomes are owner-only; managers get
-- STRIPPED aggregates via deliberate service-role paths). 0082 fixed the write
-- side; this fixes the read side.
--
-- BLAST RADIUS (traced before writing):
--   - Team analytics (managers' aggregates) already reads via the SERVICE-ROLE
--     client and gates managers in-route, so it BYPASSES this RLS entirely —
--     unaffected. (Verified: team-analytics/route.ts uses createAdminClient.)
--   - The agent dashboard + listAgentSessions read the caller's OWN agent_id,
--     so they hit the owner branch — unaffected.
--   - getSession (user client) powers the session-operation routes (dissect /
--     review / ask-coach / after-pitch). Those already RELY on RLS for scoping
--     and handle a null session, so they now enforce exactly this model:
--     owner operates on own, company-admin on any, no code change.
--
-- FLAGGED CONSEQUENCE (founder can widen with one line if desired): this uses
-- the LITERAL choice "CEO / COO / admin". A Sales-Coach manager whose
-- sales_coach_role = 'admin' but who is NOT a company admin therefore loses
-- read access to OTHER reps' individual sessions (they keep their own, plus the
-- team AGGREGATES via team-analytics, which is service-role). If the intended
-- "manager" set is the broader one team-analytics uses (company-admin OR
-- sales_coach_role='admin'), add `or p.sales_coach_role = 'admin'` to each
-- admin subquery below.
--
-- Idempotent (§A12): drop-policy-if-exists + recreate. RLS-only; no app code
-- asserts this is applied (reads degrade to owner-only if it isn't — strictly
-- safer, never broader), so there is no migration-coupling risk.

-- coaching_sessions: owner, or a company admin in the same company.
drop policy if exists "coaching_sessions - select" on coaching_sessions;
create policy "coaching_sessions - select" on coaching_sessions
  for select using (
    coaching_sessions.agent_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = coaching_sessions.company_id
        and p.role in ('CEO', 'COO', 'admin')
    )
  );

-- coaching_transcript_segments: readable iff you may read the parent session
-- (owner, or company admin). Explicit check via the session join — mirrors the
-- 0082 insert style and does not depend on RLS-subquery propagation.
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
              and p.role in ('CEO', 'COO', 'admin')
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
              and p.role in ('CEO', 'COO', 'admin')
          )
        )
    )
  );
