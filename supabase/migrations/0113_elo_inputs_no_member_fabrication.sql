-- 0113 — item-12 SIBLING (MED): close §3.5 ELO self-fabrication.
--        Members can direct-PostgREST-insert their OWN coaching_sessions / after_pitch_
--        summaries / transcript_segments / cues (agent_id = self) with fabricated content
--        → self-inflate their §3.5 ELO or corrupt the transcript the review reasons from.
--
-- ⚠️ UNAPPLIED. Low-risk (pure RLS tightening, no function security-mode change — unlike
--    0112), but it touches the flagship Sales Coach, so on staging: create a session +
--    run the realtime pipeline once to confirm writes still land (they will — all writes
--    are service-role, which bypasses RLS; this only removes DIRECT member inserts).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS IS THE COMPLETION OF 0082 (not a new class)
-- ─────────────────────────────────────────────────────────────────────────────
-- 0082 tightened these INSERT policies company-scope → OWNER-scope, closing CROSS-agent
-- fabrication (you can't insert a session for a COLLEAGUE). It deliberately stopped there
-- — its scope was cross-agent. It left member SELF-insert (agent_id = self) intact. The
-- item-12 sibling audit (docs/AUDIT-2026-07-09-brain-injection.md) is the finding that
-- self-insert is itself a vector: salesElo.ts reads after_pitch_summaries (232) +
-- coaching_sessions (281) + coach.dissect_generated events by actor=self, so a member who
-- direct-inserts their own high-scoring rows inflates their own ELO. This migration closes
-- that residual by removing member direct-insert entirely; the service-role pipeline still
-- writes (it bypasses RLS).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SAFE BY CONSTRUCTION — re-verified headless 2026-07-09 (0082's claim, re-checked because
-- Live Sales Coach shipped features after 0082 and its verification could have gone stale)
-- ─────────────────────────────────────────────────────────────────────────────
-- Enumerated EVERY insert into all four tables across src/: all five insert sites are in
-- salesCoach.ts (148, 262, 306, 320, 557) and each is preceded by createServiceRoleClient().
-- ZERO user-client inserts exist. So removing the member INSERT policies breaks NO app path
-- — it removes only the direct-PostgREST member-insert vector (the fabrication). Reads
-- (SELECT policies) and the service-role writes are untouched.
--
-- NOT covered here (still flagged, genuinely harder): coach.dissect_generated events are
-- emitted USER-scoped (dissect route uses createClient), so the events INSERT policy can't
-- distinguish legit emission from fabrication of the same kind — that one needs the emission
-- moved to a service/DEFINER path first (the events-fabrication residual of 0103). Left for
-- the founder's design call, same as the brain-events remediation framing.
--
-- FUTURE NOTE: if a user-client session-create is ever added (e.g. a browser "start session"
-- writing via the anon key + user JWT), re-add an owner-scoped INSERT policy for the SHELL
-- and instead freeze the graded/score columns against member UPDATE (a check trigger, like
-- 0105's immutability) — so the member creates the row but not the score. Not needed today.
--
-- §A12 idempotent (drop-if-exists; no create).

-- Remove member direct-insert on the four ELO-input / review-input tables. With RLS enabled
-- and no permissive INSERT policy, member inserts default-deny; service-role bypasses RLS.
drop policy if exists "coaching_sessions - insert"            on coaching_sessions;
drop policy if exists "after_pitch_summaries - insert owner"  on after_pitch_summaries;
drop policy if exists "coaching_transcript_segments - insert" on coaching_transcript_segments;
drop policy if exists "coaching_cues - insert"                on coaching_cues;

-- (If a future migration re-introduces a legit user-client insert, recreate an owner-scoped
--  INSERT policy here AND add a column-freeze trigger on the graded fields — see FUTURE NOTE.)

-- ── POST-APPLY CHECK (run after applying; every row should read PASS) ──────────
-- Confirms member direct-insert is gone on all four tables. Reads are unaffected;
-- service-role writes bypass RLS so the pipeline is untouched. Read-only.
--   with c(t, passed) as (
--     select 'coaching_sessions',            not exists (select 1 from pg_policies where tablename='coaching_sessions'            and cmd in ('INSERT','ALL'))
--     union all select 'after_pitch_summaries',        not exists (select 1 from pg_policies where tablename='after_pitch_summaries'        and cmd in ('INSERT','ALL'))
--     union all select 'coaching_transcript_segments', not exists (select 1 from pg_policies where tablename='coaching_transcript_segments' and cmd in ('INSERT','ALL'))
--     union all select 'coaching_cues',                not exists (select 1 from pg_policies where tablename='coaching_cues'                and cmd in ('INSERT','ALL')))
--   select case when passed then 'PASS' else 'FAIL — member insert policy still present' end as status, t from c order by t;
