-- 0165 acceptance — KPIs (burn, runway, DSO, gross + net margin). Staging, 0116–0165 applied.
--
-- WHAT THIS FILE IS REALLY TESTING: that the system REFUSES to produce a number it cannot honestly
-- compute.
--
-- Every assertion below has the same shape — "given a state where the ratio is undefined, is the answer
-- NULL, or is it a confident lie?" That is the entire risk surface of a KPI. A total is wrong loudly
-- (negative cash is obvious). A ratio is wrong QUIETLY, and it is the kind of number that gets repeated
-- in a board meeting before anyone checks it.
--
-- The failure modes being defended against, each of which INVERTS the truth:
--     runway = 0   would say "out of money TODAY"        (truth: not burning at all)
--     DSO    = 0   would say "customers pay INSTANTLY"   (truth: there is no revenue to measure)
--     margin = 100 would say "we sell at pure profit"    (truth: we do not track COGS yet)

begin;

-- ── Structure: the view exists and exposes the honesty flag ──
do $$ begin
  if exists (select 1 from pg_views where viewname = 'fin_kpis')
  then raise notice 'KPI PASS: fin_kpis exists';
  else raise notice 'KPI FAIL: fin_kpis missing'; end if;

  -- cogs_tracked is what lets the UI say WHY gross margin is absent instead of rendering a blank the
  -- user reads as a bug. If it disappears, the dashboard starts lying by omission.
  if exists (
    select 1 from information_schema.columns
     where table_name = 'fin_kpis' and column_name = 'cogs_tracked'
  ) then raise notice 'KPI PASS: cogs_tracked exposed — the UI can explain a missing gross margin';
  else raise notice 'KPI FAIL: cogs_tracked missing — a blank margin will read as a broken dashboard';
  end if;

  -- The nulls are the product. If someone "helpfully" coalesces them in the view, every guard below dies
  -- silently and the dashboard starts reporting confident falsehoods.
  if exists (
    select 1 from pg_views
     where viewname = 'fin_kpis'
       and definition ~* 'coalesce\s*\(\s*(round\s*\()?\s*(case|.*runway|.*dso|.*margin)'
  ) then
    raise notice 'KPI WARN: a coalesce appears near a ratio — verify no ratio has been defaulted to 0';
  else
    raise notice 'KPI PASS: ratios are not blanket-coalesced';
  end if;
end $$;

rollback;

-- ══ APP-LAYER (a company with posted entries) ════════════════════════════════════════════
--
-- A · NOT BURNING → runway MUST be NULL, not 0.
--     Post revenue 100,000 and expenses 40,000 over the window.
--     monthly_burn MUST be NULL   (a burn rate for a profitable company is meaningless, not small)
--     runway_months MUST be NULL  (infinite runway is not zero)
--     If runway comes back 0, the dashboard tells a PROFITABLE company it is out of money today. That is
--     the single most damaging thing this view could do.
--
-- B · BURNING → the arithmetic must be right.
--     Expenses 120,000, revenue 0, cash 30,000 over 12 months.
--     monthly_burn  = 120,000 / 12 = 10,000.0000
--     runway_months = 30,000 / 10,000 = 3.0
--     Assert both exactly. A burn computed over the wrong window (say 1 month) yields 120,000/mo and a
--     runway of 0.25 — a company would fire people over that number.
--
-- C · NO REVENUE → DSO MUST be NULL, not 0.
--     With zero revenue but 5,000 of AR outstanding, dso_days MUST be NULL.
--     A 0 here reads as "customers pay us the same day" — the opposite of the truth, which is that we
--     have no basis to say anything at all.
--
-- D · DSO arithmetic.
--     Revenue 365,000 over the window (= 1,000/day) and AR outstanding 45,000 → dso_days = 45.0.
--     Assert exactly. This is the number a CFO uses to decide whether to hire a collections person.
--
-- E · NO COGS ACCOUNT → gross_margin_pct MUST be NULL and cogs_tracked MUST be false.
--     THE ASSERTION THIS FILE EXISTS FOR. With revenue 100,000, expenses 60,000, and NO account whose
--     subtype is 'cogs' (nor a 5xxx code):
--         gross_margin_pct  MUST be NULL     (we cannot compute it — we do not track COGS)
--         net_margin_pct    MUST be 40.0     (this one we CAN compute honestly)
--         cogs_tracked      MUST be false
--     If gross_margin_pct comes back 40.0, the system has silently redefined GROSS margin as NET margin.
--     A founder would then compare 40% against industry GROSS-margin benchmarks (often 70–80% for
--     software, 20–30% for retail) and draw a completely false conclusion about the business. The
--     statement balances, every total is right, and the strategic read is wrong.
--
-- F · WITH a COGS account → gross margin becomes real.
--     Create an expense account with subtype='cogs' (or code 5000). Post revenue 100,000, COGS 30,000,
--     other expenses 30,000.
--         gross_margin_pct MUST be 70.0   ((100k − 30k) / 100k)
--         net_margin_pct   MUST be 40.0   ((100k − 60k) / 100k)
--         cogs_tracked     MUST be true
--     The two numbers being DIFFERENT is the proof that the distinction is real and not cosmetic.
--
-- G · Window. All ratios are computed over a trailing 12 months. Post an entry 13 months old and confirm
--     it is EXCLUDED — a burn rate contaminated by ancient history is not a burn rate.
