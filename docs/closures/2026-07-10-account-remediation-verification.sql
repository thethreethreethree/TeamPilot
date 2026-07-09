-- ─────────────────────────────────────────────────────────────────────────────
-- Post-apply verification for the account-creation remediation migrations:
--   0113 (ELO-input member-fabrication lockout), 0114 (F1 invite email-match),
--   0115 (F2 member.joined on company-attach).
--
-- Run IN EACH ENVIRONMENT after applying, then (for 0114/0115) run the behavioral
-- staging tests noted in each migration header — shape-correct is necessary, not
-- sufficient. Read-only (catalog SELECTs only). Every row should read PASS.
--
-- 0114/0115 change FUNCTION BODIES, so these checks assert the body contains the new
-- logic (a substring probe) — weaker than a policy-existence check, hence the required
-- behavioral test. 0113 checks policy removal (definitive).
-- ─────────────────────────────────────────────────────────────────────────────

with checks(migration, fix, passed) as (

  -- 0114 (F1) — accept_invitation now compares the caller's email to the invite email.
  select '0114', 'accept_invitation reads the caller email (auth.users lookup added)',
    exists (select 1 from pg_proc
            where proname = 'accept_invitation'
              and prosrc ilike '%from auth.users where id = v_user_id%')
  union all select '0114', 'accept_invitation enforces email match (rejects mismatch)',
    exists (select 1 from pg_proc
            where proname = 'accept_invitation'
              and prosrc ilike '%v_invite.email%'
              and prosrc ilike '%is distinct from%'
              and prosrc ilike '%Sign in with that email%')

  -- 0115 (F2) — member.joined now also fires on the company_id NULL->set transition.
  union all select '0115', 'emit_member_joined_event fires on company-attach (OLD.company_id is null branch)',
    exists (select 1 from pg_proc
            where proname = 'emit_member_joined_event'
              and prosrc ilike '%OLD.company_id is null%')

  -- 0113 (item-12 sibling) — member direct-insert removed on the 4 ELO-input tables.
  union all select '0113', 'coaching_sessions: no member INSERT/ALL policy',
    not exists (select 1 from pg_policies where tablename = 'coaching_sessions' and cmd in ('INSERT','ALL'))
  union all select '0113', 'after_pitch_summaries: no member INSERT/ALL policy',
    not exists (select 1 from pg_policies where tablename = 'after_pitch_summaries' and cmd in ('INSERT','ALL'))
  union all select '0113', 'coaching_transcript_segments: no member INSERT/ALL policy',
    not exists (select 1 from pg_policies where tablename = 'coaching_transcript_segments' and cmd in ('INSERT','ALL'))
  union all select '0113', 'coaching_cues: no member INSERT/ALL policy',
    not exists (select 1 from pg_policies where tablename = 'coaching_cues' and cmd in ('INSERT','ALL'))
)
select
  migration,
  case when passed then 'PASS' else 'FAIL — apply this migration / re-check' end as status,
  fix
from checks
order by migration, fix;

-- Expected: every row PASS. Then the behavioral tests:
--   0114 → invite email X, accept as X (ok) / accept as Y (rejected).
--   0115 → attach an orphaned profile to a company, confirm exactly one member.joined event.
--   0113 → confirm the realtime coach pipeline still writes (service-role, bypasses RLS).
