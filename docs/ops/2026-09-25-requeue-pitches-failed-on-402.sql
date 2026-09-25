-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Re-queue door pitches that were marked `failed` by the DeepSeek billing outage.
--
-- NOT RUN. Written 2026-09-25; runs only on the founder's go-ahead, in the Supabase SQL editor of the
-- PRODUCTION project, one step at a time.
--
-- WHAT HAPPENED (production logs, Vercel project `team-pilot`):
--   · 2026-09-22 17:00:40 +08 — first `DeepSeek API error 402: Insufficient Balance`.
--   · From then, every pitch analysis failed. The worker retried each pitch MAX_PITCH_ATTEMPTS (5)
--     times and then wrote status='failed', error='Processing failed after 5 attempts: DeepSeek API
--     error 402: …'. A top-up does not bring those back: `failed` is terminal, the sweep never
--     selects it.
--   · Commit "…billing outage…" (2026-09-25) stops this recurring: a 402 now defers the pitch 15 min
--     without spending an attempt. It does NOT repair pitches already failed — that is this file.
--
-- WHY `recorded`: it restarts the pipeline from the top. The 402 happened at ANALYSIS, after the
-- transcript was written, and the worker skips speech-to-text when a transcript exists (F4), so the
-- re-run pays for analysis only. The sweep selects status in (uploading, recorded, transcribing,
-- analyzing) with run_after <= now() (lib/data/doorlog.ts claimPitchesToProcess).
--
-- SAFE TO RUN BEFORE THE TOP-UP, once the fix above is deployed: re-queued pitches will defer every
-- 15 min without dying until the balance is back. Before that fix is deployed, they would fail again.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- ── STEP 1 · DRY RUN — how many, which companies, what window. Changes nothing. ──────────────────
select
  company_id,
  count(*)                    as pitches_failed_on_402,
  min(recorded_at)            as first_recorded,
  max(recorded_at)            as last_recorded
from pitches
where status = 'failed'
  and error like '%DeepSeek API error 402%'
group by company_id
order by pitches_failed_on_402 desc;

-- ── STEP 2 · RE-QUEUE — inside a transaction; check the row count matches STEP 1 before COMMIT. ───
begin;

update pitches
set status    = 'recorded',
    attempts  = 0,
    run_after = now(),
    error     = null,
    updated_at = now()
where status = 'failed'
  and error like '%DeepSeek API error 402%';
-- The editor reports "UPDATE n". If n equals STEP 1's total: commit. If not: rollback, and stop.

commit;
-- rollback;

-- ── STEP 3 · AFTER — watch them drain. Re-run over the next ~30 min; `recorded` should fall. ─────
select status, count(*)
from pitches
where recorded_at >= '2026-09-22'
group by status
order by status;
