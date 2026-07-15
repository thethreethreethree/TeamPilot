-- 0186 — recurring-bill month-end DRIFT fix (ANCHOR-DAY, founder-decided: "recurring-drift = anchor-day").
--
-- Diagnosis (§2 diagnose-before-patch)
-- ────────────────────────────────────
-- 0140's fin_generate_recurring_bill advanced next_date with `next_date + interval '1 month'`. Postgres
-- clamps month overflow (Jan 31 + 1 month = Feb 28), and — the bug — the NEXT advance is off the CLAMPED
-- date: Feb 28 + 1 month = Mar 28, not Mar 31. So a monthly/quarterly/annual bill anchored to day 29/30/31
-- DRIFTS permanently down to day 28 after passing February and never recovers. (Weekly is exact — +7 days.)
--
-- Fix (§A26 — re-anchor from a STABLE day, never the drifted date)
-- ───────────────────────────────────────────────────────────────
-- Store an anchor_day (the day-of-month the bill recurs on). Each advance re-computes next_date to anchor_day
-- of the target period, CLAMPED to that month's last day. Because the anchor is stored and never mutated, the
-- clamp is a one-period detour, not a permanent slide:
--   anchor 31, monthly:  Jan 31 → Feb 28 (clamped) → Mar 31 (re-anchored to 31!) → Apr 30 → May 31 …
--   anchor 30, monthly:  Jan 30 → Feb 28 → Mar 30 → Apr 30 …
--
-- Backfill: anchor_day = the CURRENT next_date's day. Best achievable — the original day is unrecoverable for
-- any bill that has ALREADY drifted through a February (a day-28 row can't be told from an originally-28 one).
-- Going forward, drift STOPS: already-drifted bills hold at their current day; undrifted/new bills stay correct.
--
-- Idempotent (§A12). NOT VERIFIED against a live DB — BUILT, not TESTED. Worked examples above are the staging
-- acceptance spec. Founder applies + confirms: a monthly bill dated the 31st advances 31→(Feb clamp)→31→…

alter table fin_recurring_bills
  add column if not exists anchor_day int
    check (anchor_day is null or anchor_day between 1 and 31);

-- Backfill from the current next_date's day (see note above on drifted rows).
update fin_recurring_bills set anchor_day = extract(day from next_date)::int
  where anchor_day is null;

create or replace function fin_generate_recurring_bill(p_template_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid; v_vendor uuid; v_desc text; v_acct uuid; v_amount numeric(19,4);
  v_tax numeric(19,4); v_freq text; v_date date; v_bill uuid; v_num text;
  v_anchor int; v_first date; v_last date; v_next date;
begin
  if not fin_can_enter() then raise exception 'Not authorized to generate recurring bills'; end if;
  select company_id, vendor_id, description, account_id, amount, tax_amount, frequency, next_date, anchor_day
    into v_company, v_vendor, v_desc, v_acct, v_amount, v_tax, v_freq, v_date, v_anchor
    from fin_recurring_bills where id = p_template_id and is_active;
  if v_company is null or v_company <> auth_company_id() then raise exception 'Recurring template not found in your company'; end if;
  -- Defensive: a row created before this migration ran (or with a null anchor) anchors to its current day.
  v_anchor := coalesce(v_anchor, extract(day from v_date)::int);

  v_num := 'REC-' || to_char(v_date, 'YYYYMMDD') || '-' || substr(p_template_id::text, 1, 4);
  insert into fin_bills (company_id, vendor_id, bill_number, bill_date, status, memo, created_by)
    values (v_company, v_vendor, v_num, v_date, 'draft', 'Recurring: ' || v_desc, auth.uid())
    returning id into v_bill;
  insert into fin_bill_lines (company_id, bill_id, line_no, account_id, description, amount, tax_amount)
    values (v_company, v_bill, 1, v_acct, v_desc, v_amount, v_tax);

  -- Advance next_date. Weekly is exact (+7 days, no month-anchor). Month-based frequencies re-anchor to
  -- anchor_day of the target month, CLAMPED to that month's last day — reading the STORED anchor, so a
  -- short-month clamp is a one-period detour, never a permanent drift.
  if v_freq = 'weekly' then
    v_next := v_date + 7;
  else
    v_first := (date_trunc('month', v_date) +
                case v_freq
                  when 'monthly'   then interval '1 month'
                  when 'quarterly' then interval '3 months'
                  when 'annual'    then interval '1 year'
                end)::date;                                    -- first day of the target month
    v_last  := (date_trunc('month', v_first) + interval '1 month' - interval '1 day')::date;  -- its last day
    v_next  := v_first + (least(v_anchor, extract(day from v_last)::int) - 1);  -- anchor, clamped to month length
  end if;
  update fin_recurring_bills set next_date = v_next where id = p_template_id;

  return v_bill;  -- a DRAFT bill — approve it via the normal AP flow
end $$;
