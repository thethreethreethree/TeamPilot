-- 0170 — PHASE 7: CONTRACTOR / 1099 REPORTING.
--
-- This produces a figure that goes on a GOVERNMENT FORM and is also sent to the contractor, who will
-- compare it against their own records. It is the only output in this entire financial system that a third
-- party will actively audit us against. Every other report is read by people who want to believe it.
--
-- ── THE TRAP, AND IT IS THE WHOLE FEATURE ────────────────────────────────────────────────────
--
-- A 1099 reports CASH ACTUALLY PAID during the calendar year. It does NOT report what was billed, accrued,
-- approved, or owed. Our ledger is accrual-based: a bill dated 20 December and paid 5 January is a December
-- EXPENSE and a January PAYMENT. It belongs on NEXT year's 1099.
--
-- The obvious implementation sums bills. It would be wrong every single January, in a way that:
--   • balances perfectly (the bills are real, the expense is real, the GL ties out),
--   • matches the P&L exactly (which is what makes it look CORRECT to anyone checking),
--   • and files a false statement with a tax authority while handing the contractor a number that
--     contradicts their own bank records.
--
-- Nothing internal would ever catch it. The contractor would.
--
-- So this migration reads fin_payments.payment_date — the date the money LEFT — and nothing else.
--
-- ── THE SECOND TRAP: CURRENCY ────────────────────────────────────────────────────────────────
-- fin_payments.amount is denominated in fin_payments.currency. Summing it across a vendor paid in both USD
-- and EUR would add two different units together and print the meaningless total on a tax form.
--
-- So the amount is taken from the LEDGER, not from the payment's face value: the base-currency credit to
-- the cash account on the payment's posted entry (base_credit, server-computed by the 0118/0119 trigger and
-- never client-trusted). That figure is, by definition, the base-currency cash that left the building.
--
-- ── THE THIRD: A PAYMENT THAT NEVER POSTED IS NOT A PAYMENT ──────────────────────────────────
-- Only payments whose entry is 'posted' count. A draft or voided payment did not move money.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── Which vendors are contractors? ───────────────────────────────────
-- 1099 eligibility is a DECLARATION about a legal relationship, not something we can infer. A vendor that
-- happens to be a sole trader might be an employee elsewhere; a company is not 1099-reportable at all. We
-- do not guess: someone with authority marks the vendor, and their TIN is recorded.
alter table fin_vendors add column if not exists is_1099          boolean not null default false;
alter table fin_vendors add column if not exists tax_classification text;   -- 'individual' | 'llc' | 'corp' …
-- fin_vendors.tax_id already exists (0123) and carries the TIN/EIN.

-- ─── What we actually paid each contractor, in cash, in base currency ─
-- Reads the LEDGER for the amount, the PAYMENT for the date, and the VENDOR for eligibility.
create or replace view fin_1099_payments as
  select p.company_id,
         p.vendor_id,
         v.name                                   as vendor_name,
         v.tax_id,
         v.tax_classification,
         -- CALENDAR year of the date the money LEFT. Not the bill date. Not the fiscal year — the IRS does
         -- not care what our fiscal calendar is.
         extract(year from p.payment_date)::int   as tax_year,
         p.id                                     as payment_id,
         p.payment_date,
         -- Base-currency cash that left the building, taken from the server-computed ledger line rather
         -- than the payment's face amount (which may be in any currency).
         coalesce(sum(l.base_credit), 0)          as amount_base
    from fin_payments p
    join fin_vendors  v on v.id = p.vendor_id
    join fin_journal_entries e on e.id = p.posted_entry_id and e.status = 'posted'
    join fin_journal_lines   l on l.entry_id = e.id and l.account_id = p.cash_account_id
   where v.is_1099
   group by p.company_id, p.vendor_id, v.name, v.tax_id, v.tax_classification,
            p.id, p.payment_date;

-- ─── The filing worksheet ─────────────────────────────────────────────
-- One row per contractor per tax year, with the reporting threshold applied — and, crucially, the
-- BELOW-THRESHOLD contractors still visible.
create or replace view fin_1099_worksheet as
  select company_id,
         vendor_id,
         vendor_name,
         tax_id,
         tax_classification,
         tax_year,
         count(*)                     as payment_count,
         sum(amount_base)             as total_paid,
         -- The US threshold is 600.00. It is a DEFAULT, stated here, not a law of nature — it has changed
         -- before and applies only to some payment types. The API exposes it as a parameter.
         (sum(amount_base) >= 600)    as meets_threshold,
         -- THE FIELD THAT PREVENTS A SILENT FILING FAILURE. A contractor over the threshold with no TIN on
         -- file cannot be filed for. Reporting them as "ready" would mean discovering it in January, when
         -- they are unreachable and the deadline is days away.
         (tax_id is null or btrim(tax_id) = '') as missing_tax_id
    from fin_1099_payments
   group by company_id, vendor_id, vendor_name, tax_id, tax_classification, tax_year;

-- ─── Is this year's filing actually ready? ────────────────────────────
-- Returns the blockers, not a boolean. "Not ready" without saying why is a dead end at the worst possible
-- moment of the year.
create or replace function fin_1099_readiness(p_year int, p_threshold numeric default 600)
returns table (vendor_id uuid, vendor_name text, total_paid numeric(19,4), problem text)
language sql stable security definer set search_path = public as $$
  select w.vendor_id,
         w.vendor_name,
         w.total_paid,
         case
           when w.missing_tax_id then 'No taxpayer ID on file — this contractor cannot be filed for'
           when w.tax_classification is null then 'No tax classification — we cannot tell if they are reportable'
         end as problem
    from fin_1099_worksheet w
   where w.company_id = auth_company_id()
     and w.tax_year   = p_year
     and w.total_paid >= p_threshold
     and (w.missing_tax_id or w.tax_classification is null)
   order by w.total_paid desc;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────
-- The views inherit RLS from fin_payments / fin_vendors / fin_journal_* (all already tenant-scoped and
-- policy-covered). No new table is introduced, so no new policy surface is created — the 1099 report is a
-- LENS on existing data, not a second copy of it. A second copy would be a second thing to keep in sync,
-- and the copy would eventually disagree with the ledger it claims to summarize.
