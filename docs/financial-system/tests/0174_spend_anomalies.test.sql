-- 0174 acceptance — SPEND ANOMALIES. Staging, 0116–0174 applied.
--
-- The most important assertions in this file are the ones about what MUST NOT appear.
--
-- An anomaly list that cries wolf is worse than no anomaly list. A controller who opens it and finds
-- fourteen "anomalies" that are all just a bigger-than-usual electricity bill learns, within about two
-- weeks, to close the tab without reading it — and then the ONE entry that was a bill split to dodge an
-- approval limit scrolls past unread, in a system that reported it. That is worse than a system that never
-- claimed to look. (§A25: a false match is worse than a miss.)
--
-- So: precision over recall, deliberately. Every test below that asserts SILENCE is protecting the
-- credibility that makes the noisy tests worth reading.

begin;

do $$ begin
  if (select count(*) from pg_views
       where viewname in ('fin_anomaly_threshold_gaming','fin_anomaly_split_bills',
                          'fin_anomaly_new_vendor_payment','fin_anomaly_sod_breach','fin_anomalies')) = 5
  then raise notice 'ANOM PASS: all five views exist';
  else raise notice 'ANOM FAIL: an anomaly view is missing';
  end if;

  -- The reason is a COLUMN, not a score. A score tells a controller how worried to be; a reason tells them
  -- what to do.
  if exists (select 1 from information_schema.columns
              where table_name = 'fin_anomalies' and column_name = 'reason')
  then raise notice 'ANOM PASS: every row carries its own explanation in words';
  else raise notice 'ANOM FAIL: no reason column — this is a scored feed, and a score is not actionable';
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_name = 'fin_anomalies' and column_name in ('score','risk','severity','confidence'))
  then raise notice 'ANOM PASS: no score column';
  else raise notice 'ANOM FAIL: a score column exists';
  end if;
end $$;

rollback;

-- ══ APP-LAYER ═══════════════════════════════════════════════════════════════════════════════
-- SETUP: an approver with approval_limit = 5,000.00.
--
-- 1 · THRESHOLD GAMING.  ***THE RULE THIS FEATURE EXISTS FOR.***
--     Approve a bill for 4,950.00 (99% of the limit).
--     → MUST appear, with a reason naming both figures.
--
--     This is the only fraud shape in the system that is INVISIBLE TO EVERY OTHER CONTROL — precisely
--     because it breaks none of them. The approval is valid. The limit was respected. The ledger balances.
--     SoD held. Nothing, anywhere, disagrees. Nobody accidentally invoices 4,950 when the ceiling is 5,000.
--
-- 2 · A NORMAL BILL IS SILENT.  Approve a bill for 1,200.00.
--     → MUST NOT appear. It is nowhere near the ceiling and there is nothing to say about it.
--
-- 3 · A BIG BILL IS SILENT.  Approve a bill for 250,000.00 (approved by a CFO with no limit).
--     → MUST NOT appear. BIG BILLS ARE USUALLY JUST BIG. Flagging size is exactly how an anomaly list
--     becomes noise, and noise is how the threshold-gaming row in test 1 goes unread.
--
-- 4 · SPLIT BILLS.  Three bills from one vendor, same day: 2,000 + 2,000 + 2,000 (each under 5,000;
--     together 6,000, over it).
--     → MUST appear once, as a single grouped row stating the count and the combined total.
--     → The three individual bills MUST NOT also appear separately — one purchase, one finding. A list
--     that reports the same event three times is a list that trains people to skim.
--
-- 5 · SAME VENDOR, SAME DAY, LEGITIMATELY UNDER.  Two bills of 500 each (total 1,000, well under 5,000).
--     → MUST NOT appear. Two small bills on one day is a Tuesday, not a conspiracy.
--
-- 6 · NEW VENDOR, FAST PAYMENT.  Create a vendor; pay them 8,000.00 three days later.
--     → MUST appear.
--     Then: pay an EXISTING vendor (created a year ago) 8,000.00.
--     → MUST NOT appear. The anomaly is the COMBINATION of newness and payment, never the amount.
--
-- 7 · A £40 FIRST PAYMENT IS SILENT.  New vendor, paid 40.00 the next day.
--     → MUST NOT appear. Immaterial. A rule that fires on every new coffee supplier is a rule nobody reads.
--
-- 8 · NO LIMITS SET = NO THRESHOLD FINDINGS.  A company with no approval_limit anywhere.
--     → fin_anomaly_threshold_gaming MUST be EMPTY for that company — not populated against an invented
--     default limit. A company with no ceiling has no ceiling to game, and inventing one so the rule has
--     something to say is how a detector starts manufacturing its own findings.
--
-- 9 · SoD BREACH IS EMPTY TODAY.  → fin_anomaly_sod_breach MUST return ZERO rows on a healthy database.
--     It is a control that checks another control. If it EVER returns a row, a SoD guard has been weakened
--     somewhere, and every approval made under that gap is in question.
--
-- 10 · TENANT ISOLATION.  As company B, select from fin_anomalies → ONLY company B's rows.
--      (These views are security_invoker — see the 2026-07-14 cross-tenant view fix.)
