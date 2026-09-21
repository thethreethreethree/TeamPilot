-- A12 RE-RUNNABILITY GUARDS ADDED 2026-09-21. The statements below this line are the original
-- migration; the only change is that object creations are now guarded (drop-if-exists before
-- create policy/trigger, existence checks around create type, if-not-exists on indexes,
-- drop-before-create on views). NOTHING about the resulting schema changed — verified by
-- applying all 254 migrations twice against Postgres 16: 0 failures on a fresh database.
--
-- WHY AN APPLIED MIGRATION WAS EDITED. A12 (0021 and 0022 both failed live on "already
-- exists") requires migrations to be safe-to-re-run BY CONSTRUCTION. 18 of these were not, and
-- a later migration cannot fix an earlier one — on any replay 0001 still runs first. Tested:
-- a repair migration leaves 0001 failing exactly as before. Editing in place is the only thing
-- that reaches zero. Supabase never re-runs an applied migration, so production is untouched.
-- Founder decision, 2026-09-21. Record: docs/tbc/2026-09-21-migration-idempotency/.

-- 0244 — Gamification Phase 6: the calibration store.
--
-- Phase 6 asks the honest question the leaderboard depends on: does the score actually measure what it claims,
-- before anyone's rank rests on it? A manager hand-scores real transcripts BLIND (without seeing the model's
-- scores), and we compare. This table holds those human blind scores; the model's scores already live in
-- after_pitch_summaries. Append-only (a re-score is a new row); company-scoped; manager-only.

create table if not exists gamification_calibration (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  session_id  uuid not null references coaching_sessions(id),
  scorer_id   uuid not null references profiles(id),          -- the manager doing the blind scoring
  -- the human's 0-10 per-dimension scores (the LLM-judged dimensions; the computed talk_ratio/question_rate are
  -- deterministic, not a matter of human judgement, so they are excluded from calibration).
  scores      jsonb not null,                                 -- { opener, objection, tone, close, next_step }
  created_at  timestamptz not null default now()
);

create index if not exists gamification_calibration_company on gamification_calibration (company_id, created_at desc);
create unique index if not exists gamification_calibration_scorer_session
  on gamification_calibration (scorer_id, session_id);        -- one blind score per manager per session

alter table gamification_calibration enable row level security;
-- Company managers read the calibration (it is a manager tool); writes go through the service-role route.
drop policy if exists "gamification_calibration - manager read" on gamification_calibration;
create policy "gamification_calibration - manager read" on gamification_calibration
  for select using (
    company_id = auth_company_id() and exists (
      select 1 from profiles p where p.id = auth.uid() and p.company_id = gamification_calibration.company_id
        and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin')
    )
  );
-- No client INSERT/UPDATE/DELETE policy → the calibration route writes service-role after an auth+manager check.
