-- 0165 — PHASE 6: complete the KPI dashboard (DSO, burn, gross margin, runway) — spec §4 Phase 6.
--
-- Status before: PARTIAL. The finance dashboard showed real derived cash / revenue / expenses / net.
-- Missing were the ratios the spec names explicitly: "revenue, burn, margin, runway, DSO".
--
-- WHY A RATIO NEEDS MORE CARE THAN A TOTAL
-- A total is wrong loudly: if cash is negative, everyone notices. A RATIO is wrong quietly. DSO computed
-- over a period with no revenue divides by zero; a burn rate computed over a partial month annualises to
-- nonsense; a margin computed when COGS is not yet tracked reports 100% and looks like triumph. Each of
-- those is a number someone repeats in a board meeting.
--
-- So every ratio here returns NULL — not 0, not a made-up figure — when its denominator is absent or its
-- input is not yet being tracked. NULL renders as "—" and invites a question. A 0 or a 100% renders as a
-- FACT and invites a decision. (§3.4: honesty is the moat; §5: distrust the confident number.)
--
-- THE MARGIN CAVEAT, stated in the data rather than hidden in a doc:
-- Gross margin = (revenue − COGS) / revenue. COGS is not yet tracked (it lands with the inventory system,
-- last in the build). Reporting margin as (revenue − ALL expenses) / revenue would silently redefine gross
-- margin as NET margin — a materially different and much lower number that people would compare against
-- industry gross-margin benchmarks and draw false conclusions from. So `gross_margin_pct` is NULL until a
-- COGS account exists, and `net_margin_pct` — which we CAN compute honestly — is exposed alongside it,
-- clearly named. Two honest numbers beat one confident wrong one.
--
-- Idempotent (create or replace). No new tables — a lens over posted lines.
-- NOT VERIFIED against a live database. BUILT, not TESTED.

create or replace view fin_kpis as
with base as (
  select
    c.id as company_id,
    -- Trailing 12 months of posted activity. A shorter window makes every ratio hostage to one big invoice.
    (current_date - interval '12 months')::date as win_from,
    current_date as win_to
  from companies c
),
amounts as (
  select
    b.company_id,
    b.win_from,
    b.win_to,
    -- Revenue is credit-normal: credits increase it.
    coalesce(sum(case when a.type = 'revenue' then l.base_credit - l.base_debit else 0 end), 0) as revenue,
    -- Expenses are debit-normal.
    coalesce(sum(case when a.type = 'expense' then l.base_debit - l.base_credit else 0 end), 0) as expenses,
    -- COGS only if a Cost of Goods Sold account actually exists (subtype or the conventional 5xxx code).
    -- If none exists we must NOT silently treat all expense as COGS — see the header.
    coalesce(sum(case
        when a.type = 'expense'
         and (coalesce(a.subtype,'') = 'cogs' or a.code like '5%')
        then l.base_debit - l.base_credit else 0 end), 0) as cogs,
    -- Does a COGS account exist at all? This is the flag that decides whether gross margin is honest.
    bool_or(a.type = 'expense' and (coalesce(a.subtype,'') = 'cogs' or a.code like '5%')) as has_cogs
  from base b
  join fin_journal_entries e
    on e.company_id = b.company_id
   and e.status = 'posted'
   and e.entry_date between b.win_from and b.win_to
  join fin_journal_lines l on l.entry_id = e.id
  join fin_accounts a on a.id = l.account_id
  group by b.company_id, b.win_from, b.win_to
),
cash_now as (
  select cf.company_id, coalesce(sum(l.base_debit - l.base_credit), 0) as cash_balance
  from fin_cash_accounts cf
  join fin_journal_lines l on l.account_id = cf.id
  join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
  group by cf.company_id
),
receivables as (
  -- What customers still owe: issued invoices, net of receipts and issued credit notes.
  select
    i.company_id,
    coalesce(sum(
      (select coalesce(sum(il.amount + il.tax_amount),0) from fin_invoice_lines il where il.invoice_id = i.id)
      - (select coalesce(sum(r.amount),0) from fin_receipts r where r.invoice_id = i.id)
      - (select coalesce(sum(cl.amount + cl.tax_amount),0)
           from fin_credit_note_lines cl
           join fin_credit_notes cn on cn.id = cl.credit_note_id
          where cn.invoice_id = i.id and cn.status = 'issued')
    ), 0) as ar_outstanding
  from fin_invoices i
  where i.status = 'sent'
  group by i.company_id
)
select
  am.company_id,
  am.win_from,
  am.win_to,
  am.revenue,
  am.expenses,
  (am.revenue - am.expenses)                as net_profit,
  coalesce(cn.cash_balance, 0)              as cash_balance,
  coalesce(rc.ar_outstanding, 0)            as ar_outstanding,

  -- ── Burn: average monthly NET cash consumption over the window. NULL if the company is profitable
  --    (a "burn rate" for a profitable company is not a small number, it is a meaningless one).
  case
    when (am.expenses - am.revenue) > 0
      then round((am.expenses - am.revenue) / 12.0, 4)
    else null
  end                                        as monthly_burn,

  -- ── Runway: months of cash left at that burn. NULL when not burning (infinite runway is not "0").
  case
    when (am.expenses - am.revenue) > 0 and coalesce(cn.cash_balance,0) > 0
      then round(coalesce(cn.cash_balance,0) / nullif((am.expenses - am.revenue) / 12.0, 0), 1)
    else null
  end                                        as runway_months,

  -- ── DSO: how many days of sales are sitting unpaid. NULL when there is no revenue to divide by —
  --    a DSO of 0 on zero revenue would read as "customers pay instantly", the opposite of the truth.
  case
    when am.revenue > 0
      then round(coalesce(rc.ar_outstanding,0) / nullif(am.revenue / 365.0, 0), 1)
    else null
  end                                        as dso_days,

  -- ── Gross margin: HONESTLY NULL until COGS is tracked. See the header — reporting
  --    (revenue − all expenses)/revenue here would silently redefine gross margin as NET margin and
  --    invite a false comparison against industry gross-margin benchmarks.
  case
    when am.has_cogs and am.revenue > 0
      then round(((am.revenue - am.cogs) / nullif(am.revenue, 0)) * 100, 1)
    else null
  end                                        as gross_margin_pct,

  -- ── Net margin: this one we CAN compute honestly today, so it is exposed and clearly named.
  case
    when am.revenue > 0
      then round(((am.revenue - am.expenses) / nullif(am.revenue, 0)) * 100, 1)
    else null
  end                                        as net_margin_pct,

  am.has_cogs                                as cogs_tracked
from amounts am
left join cash_now    cn on cn.company_id = am.company_id
left join receivables rc on rc.company_id = am.company_id;
