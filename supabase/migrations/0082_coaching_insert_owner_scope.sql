-- 0082_coaching_insert_owner_scope.sql
--
-- Harden the Live Sales Coach (0070) INSERT RLS from company-scoped to
-- OWNER-scoped. Found by a ground-up audit (§1.7 / §1.3 outside-view) of the
-- flagship foundation the founder was reviewing.
--
-- THE GAP. Every app write to these tables goes through the service-role
-- client (createSession, appendTranscriptSegment, appendCue all call
-- createServiceRoleClient), which BYPASSES RLS. So the user-facing INSERT
-- policies from 0070 only ever gate DIRECT PostgREST calls — a browser using
-- the public anon key plus a logged-in user's JWT. Those 0070 policies checked
-- only company membership, so a same-company user could, via direct REST:
--   - insert a coaching_session attributed to a COLLEAGUE (agent_id = someone
--     else in the company), polluting that colleague's coaching record; or
--   - inject fabricated transcript segments / cues into a colleague's session,
--     corrupting the transcript the post-call review reasons from.
-- Neither has a legitimate use case — a §A18 data-integrity hole.
--
-- THE FIX. Tighten the three INSERT policies to owner scope: you may only
-- create your OWN session, and only append segments / cues to a session you
-- own. Company membership is still enforced on the session (belt).
--
-- SAFE BY CONSTRUCTION. The realtime pipeline and every data-layer helper write
-- via service-role, which bypasses RLS entirely — so tightening the user-facing
-- policy CANNOT affect any app write path. It only removes the direct-PostgREST
-- cross-agent write vector. (Verified: no user-client insert into these tables
-- exists in the codebase; all three helpers use createServiceRoleClient.)
--
-- NOT CHANGED HERE — a founder DESIGN decision, flagged separately: the SELECT
-- (read) policies are company-wide ("a member can see sessions in their own
-- company", 0070). For personal call transcripts that may be too open (cf. the
-- strategy-library "own only" §A18 stance) — but it may also be an intended
-- team-coaching-visibility feature. Reads are left intact pending that call;
-- this migration only tightens WRITES, which have no such ambiguity.
--
-- Idempotent (§A12): drop-policy-if-exists + recreate. Additive RLS only; the
-- app does not assert this migration is applied (service-role writes work
-- regardless), so there is no migration-coupling risk.

-- coaching_sessions: you may only create your OWN session (agent_id = you),
-- and only within your own company.
drop policy if exists "coaching_sessions - insert" on coaching_sessions;
create policy "coaching_sessions - insert" on coaching_sessions
  for insert with check (
    coaching_sessions.agent_id = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = coaching_sessions.company_id
    )
  );

-- coaching_transcript_segments: you may only append to a session you own.
drop policy if exists "coaching_transcript_segments - insert" on coaching_transcript_segments;
create policy "coaching_transcript_segments - insert" on coaching_transcript_segments
  for insert with check (
    exists (
      select 1 from coaching_sessions s
      where s.id = coaching_transcript_segments.session_id
        and s.agent_id = auth.uid()
    )
  );

-- coaching_cues: you may only append to a session you own.
drop policy if exists "coaching_cues - insert" on coaching_cues;
create policy "coaching_cues - insert" on coaching_cues
  for insert with check (
    exists (
      select 1 from coaching_sessions s
      where s.id = coaching_cues.session_id
        and s.agent_id = auth.uid()
    )
  );
