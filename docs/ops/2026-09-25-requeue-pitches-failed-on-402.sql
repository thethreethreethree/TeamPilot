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

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- RUN 2026-10-03 (founder picker: "Re-queue the 9 now"). The header's "NOT RUN" was true until then.
--   · Before: STEP 1 found 9, all company 28203036, recorded 2026-09-22 23:07 .. 09-24 18:40 UTC, all 9 with a
--     transcript (so analysis only). DeepSeek checked healthy first (chat 200 in 276 ms; balance USD 6.60).
--   · STEP 2 at 2026-10-03T05:01:59Z, in one transaction that committed only because exactly 9 rows changed.
--     Re-queued: 94e43096 413e3f1f e1f61d2e 9a26523d bcb8e9da 9042f036 954a668e 52e1aea4 4c6c3c91
--   · STEP 3: 05:02:33Z recorded 9; 05:03:34Z complete 6, recorded 3. (Outcome appended below when drained.)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- OUTCOME (2026-10-03): all 9 complete by 05:04:36Z, none failed. They were rolled into the rep's summaries
-- (31 summary rewrites, 05:03-05:06Z), and the DeepSeek balance went 6.60 -> 6.52 (USD 0.08 for 9 analyses and
-- their summary refresh).
