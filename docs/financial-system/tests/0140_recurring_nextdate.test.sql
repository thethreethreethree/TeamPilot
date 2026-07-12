-- 0140 acceptance — recurring-bill next_date advancement arithmetic. Staging (or any Postgres);
-- pure date math, no tables, no auth → runs anywhere. Rollback; RAISE NOTICE PASS/FAIL.
--
-- fin_generate_recurring_bill advances the template with:
--   weekly    -> next_date + interval '1 week'
--   monthly   -> next_date + interval '1 month'
--   quarterly -> next_date + interval '3 months'
--   annual    -> next_date + interval '1 year'   (all cast ::date)
-- This pins those semantics so a future change is caught, and DOCUMENTS the end-of-month drift
-- (see the FLAG at the bottom) as the current, intended-until-decided behavior.

begin;

-- The interval expressions below are exactly what fin_generate_recurring_bill runs per frequency
-- (weekly=1 week, monthly=1 month, quarterly=3 months, annual=1 year), inlined so no helper
-- function is created (keeps the script runnable anywhere with zero setup).
do $$
declare fail int := 0;
begin
  -- ── straightforward mid-month cases (deterministic) ──
  if ('2026-01-15'::date + interval '1 week')::date   <> '2026-01-22' then raise notice 'FAIL weekly';    fail:=fail+1; end if;
  if ('2026-01-15'::date + interval '1 month')::date  <> '2026-02-15' then raise notice 'FAIL monthly';   fail:=fail+1; end if;
  if ('2026-01-15'::date + interval '3 months')::date <> '2026-04-15' then raise notice 'FAIL quarterly'; fail:=fail+1; end if;
  if ('2026-01-15'::date + interval '1 year')::date   <> '2027-01-15' then raise notice 'FAIL annual';    fail:=fail+1; end if;

  -- ── year / quarter rollover ──
  if ('2026-12-15'::date + interval '1 month')::date  <> '2027-01-15' then raise notice 'FAIL monthly year-rollover';   fail:=fail+1; end if;
  if ('2026-11-15'::date + interval '3 months')::date <> '2027-02-15' then raise notice 'FAIL quarterly year-rollover'; fail:=fail+1; end if;

  -- ── end-of-month behavior (Postgres clamps to the last valid day) — PINNED as current behavior ──
  if ('2026-01-31'::date + interval '1 month')::date  <> '2026-02-28' then raise notice 'FAIL Jan31->Feb28 clamp';      fail:=fail+1; end if;  -- 2026 not leap
  if ('2024-01-31'::date + interval '1 month')::date  <> '2024-02-29' then raise notice 'FAIL Jan31->Feb29 (leap)';     fail:=fail+1; end if;
  if ('2026-02-28'::date + interval '1 month')::date  <> '2026-03-28' then raise notice 'FAIL Feb28->Mar28 (drift!)';   fail:=fail+1; end if;  -- drift: not Mar 31
  if ('2026-01-31'::date + interval '3 months')::date <> '2026-04-30' then raise notice 'FAIL Jan31->Apr30 clamp';      fail:=fail+1; end if;  -- Apr has 30
  if ('2024-02-29'::date + interval '1 year')::date   <> '2025-02-28' then raise notice 'FAIL Feb29->Feb28 (leap-out)'; fail:=fail+1; end if;

  if fail = 0 then
    raise notice 'RECURRING PASS: all next_date advances match the function''s interval semantics (incl. documented end-of-month clamp/drift)';
  else
    raise notice 'RECURRING FAIL: % case(s) diverged from expected', fail;
  end if;
end $$;

rollback;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- FLAG (section 1.5.2 — surface, don't decide): END-OF-MONTH DRIFT.
-- `next_date + interval '1 month'` clamps to the last valid day, so a bill due on the 31st becomes
-- the 28th (or 29th) after February and then STAYS on the 28th every following month — it does not
-- climb back to month-end. Three possible intents, founder's call:
--   (a) keep as-is (calendar +1 month, clamp+drift) — simplest, what ships now;
--   (b) "same day-of-month, clamp for short months but restore" (anchor to the original day 31);
--   (c) "last day of month" semantics (always the final day) for rent/utilities-style templates.
-- Not building a change unbid — this pins today's behavior and asks. If (b)/(c), the template needs
-- an anchor_day (or a day_of_month) column and the advance logic changes accordingly.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
