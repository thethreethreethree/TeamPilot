-- 0175 acceptance — CASH FORECAST. Staging, 0116–0175 applied.
--
-- This forecast is the number a founder makes a HIRING DECISION against. Every assertion below exists
-- because a plausible-looking wrong answer here does not get caught by anything downstream — there is no
-- reconciliation for a forecast. It is right or it quietly ruins someone.

begin;

do $$ begin
  -- The forecast must NOT be a stored table. A materialized forecast is a second copy of the truth that
  -- drifts from the documents it claims to summarize, and nobody ever notices it has gone stale.
  if not exists (select 1 from information_schema.tables where table_name = 'fin_forecast_rows')
  then raise notice 'FORECAST PASS: the forecast is derived, never stored — it cannot go stale';
  else raise notice 'FORECAST FAIL: a stored forecast table exists and will drift from the documents';
  end if;

  if exists (select 1 from information_schema.views where table_name = 'fin_cash_gap')
  then raise notice 'FORECAST PASS: the uncommitted GAP is a first-class output, not an omission';
  else raise notice 'FORECAST FAIL: no gap view — the forecast silently understates without saying so';
  end if;
end $$;

rollback;

-- ══ APP-LAYER ═══════════════════════════════════════════════════════════════════════════════
--
-- 1 · NO DOUBLE-COUNTING OF A SCHEDULED BILL.  ***THE MOST LIKELY BUG IN THIS FEATURE.***
--     Approve a bill for 10,000 due in 30 days. Then SCHEDULE a payment of 10,000 for that same bill.
--     → The 10,000 MUST appear in the forecast exactly ONCE.
--
--     Counting both the unpaid bill AND its scheduled payment doubles the outflow. The company would appear
--     to run out of money WEEKS EARLIER THAN IT DOES — and the founder, reading a date that says "you are
--     insolvent in six weeks", cancels a hire, or takes expensive money, on the strength of a number that
--     was wrong by exactly one duplicated row. No downstream check would ever catch it, because a forecast
--     reconciles against nothing.
--
-- 2 · OVERDUE OBLIGATIONS ARE PULLED TO TODAY, NEVER DROPPED.
--     Approve a bill for 5,000 that was due 10 days AGO and is still unpaid.
--     → It MUST appear on day 0 of the forecast, not vanish.
--     A forecast that discards past-due obligations shows the company holding cash it does not have. An
--     overdue bill is MORE urgent than a future one, not less.
--
-- 3 · THE STARTING POINT IS THE LEDGER, NOT AN ASSUMPTION.
--     fin_cash_today MUST equal the cash-account balance on the balance sheet, to the penny.
--     If the forecast and the balance sheet disagree about where the company stands TODAY, the forecast is
--     worthless from day zero — and a founder comparing the two pages would have no way to tell which lied.
--
-- 4 · CREDIT NOTES REDUCE EXPECTED INFLOW.
--     Invoice a customer 10,000; issue a 4,000 credit note against it.
--     → The forecast MUST expect 6,000, not 10,000. (fin_invoice_summary already nets credits — 0143.)
--     Forecasting cash that has been credited away is forecasting money that is never coming.
--
-- 5 · DRAFT DOCUMENTS ARE NOT COMMITMENTS.
--     A DRAFT bill and a DRAFT invoice MUST NOT appear. A draft is a thought, not an obligation — and a
--     forecast built on thoughts is the extrapolation we explicitly rejected, wearing a commitment's
--     clothes.
--
-- 6 · THE GAP IS STATED, NOT PADDED.
--     Company with 10,000 cash, 40,000 committed inflow, 95,000 committed outflow over 90 days.
--     → fin_cash_gap.gap MUST be 45,000 (95,000 − 40,000 − 10,000).
--     That is the money that must come from business not yet invoiced. The system must NEVER invent it,
--     assume it from last quarter's average, or quietly close the gap so the chart looks calmer. A forecast
--     that projects last year's customers is at its most confident exactly when it is most wrong — which is
--     the moment the company lost one of them.
--
-- 7 · A COMPANY WITH NO COMMITMENTS FORECASTS FLAT, NOT EMPTY.
--     → Every day MUST return, showing today's cash carried forward unchanged. A blank chart reads as "we
--     don't know"; a flat line reads as "nothing is scheduled" — which is the truth.
--
-- 8 · TENANT ISOLATION.  fin_cash_forecast pins company from auth_company_id() and is SECURITY DEFINER.
--     Company B MUST NOT see company A's commitments. The views are security_invoker (the 2026-07-14 fix).
--
-- 9 · HORIZON GUARD.  fin_cash_forecast(0) and fin_cash_forecast(400) MUST RAISE.
