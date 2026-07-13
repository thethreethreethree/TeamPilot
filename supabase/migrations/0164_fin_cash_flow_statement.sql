-- 0164 — PHASE 6: CASH FLOW STATEMENT (the third core financial statement).
--
-- Spec: FinancialSystem.md §4 Phase 6 — "Core financial statements: … Cash Flow Statement".
-- P&L, Balance Sheet and Trial Balance exist (0134/0144). This is the missing one.
--
-- METHOD: DIRECT, derived from actual movements through the CASH accounts.
-- Every posted line that touches a cash account IS a cash movement — that is not an estimate, it is the
-- fact itself. Each movement is then classified by what the OTHER side of its entry was. This keeps the
-- §3 traceability rule intact: every figure on this statement drills straight through to the posted lines
-- that produced it. (The indirect method would start from net income and back out non-cash items —
-- defensible, but it depends on a fixed-asset register and depreciation, which do not exist yet.)
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- THE TRAP THIS VIEW IS BUILT AROUND — read this before changing the classification.
--
-- The NET CHANGE IN CASH ties out no matter how you classify the sections. Move a loan repayment from
-- Financing into Operating and the bottom line is IDENTICAL. The statement still balances. Cash still
-- reconciles to the bank. Nothing anywhere in this system would flag it — and yet the statement now says
-- something false about how the company generates money, which is the ONLY question it exists to answer.
--
-- This is the same shape as a reconciliation entry posted backwards (0163): perfectly balanced, entirely
-- wrong, undetectable by any balance check.
--
-- The defence is to make misclassification VISIBLE rather than silent:
--   • A movement we cannot confidently classify goes to 'unclassified' — it is NOT dumped into Operating
--     to make the statement look tidy. A visible "unclassified: 40,000" is an honest prompt to go and
--     classify the account. An invisible 40,000 sitting inside Operating is a lie with a clean bill of
--     health.
--   • The classification is driven by the account's TYPE and SUBTYPE, not by guessing at its name.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- CLASSIFICATION (by the counter-account, i.e. the non-cash side of the entry)
--   OPERATING  — revenue, expense, and the working-capital accounts (receivables, payables, tax payable,
--                employee reimbursements). Money from running the business.
--   INVESTING  — non-current assets (subtype 'fixed'/'intangible'/'investment'). Buying/selling the things
--                the business runs ON.
--   FINANCING  — equity, and non-current liabilities (subtype 'loan'/'long_term'). Money from owners and
--                lenders.
--   UNCLASSIFIED — anything else. Deliberately surfaced, never absorbed.
--
-- HONEST LIMITATION, STATED RATHER THAN HIDDEN: the INVESTING section will be empty until the fixed-asset
-- register exists (Phase 8). That is correct — the company genuinely has no recorded non-current assets
-- yet — but it is worth knowing that an empty Investing section here reflects an unbuilt feature, not a
-- company that never buys anything. When 0165+ adds the asset register with subtype='fixed', those
-- movements will start appearing here automatically, with no change to this view.
--
-- Idempotent (§A12: create or replace). No new tables — this is a lens over already-posted lines, so
-- there is nothing to keep in sync and nothing that can drift from the ledger.
--
-- NOT VERIFIED against a live database (no DB access). BUILT, not TESTED.

-- Which accounts ARE cash? Not a guess: the ones a bank account is actually linked to, plus the system
-- cash account (1000) seeded by fin_init_company. Anything else is a counter-account, by definition.
create or replace view fin_cash_accounts as
select distinct a.id, a.company_id, a.code, a.name
from fin_accounts a
where a.type = 'asset'
  and (
        exists (select 1 from fin_bank_accounts b where b.gl_account_id = a.id)
     or a.code = '1000'
  );

create or replace view fin_cash_flow as
with cash_lines as (
  -- Every posted line that MOVED cash. The signed amount in base currency: a debit to cash is money in,
  -- a credit to cash is money out.
  select
    e.company_id,
    e.period_id,
    e.entry_date,
    e.id            as entry_id,
    l.id            as line_id,
    (l.base_debit - l.base_credit) as cash_delta
  from fin_journal_lines l
  join fin_journal_entries e on e.id = l.entry_id
  join fin_cash_accounts  c on c.id = l.account_id
  where e.status = 'posted'
),
counter_lines as (
  -- The OTHER side(s) of each of those entries: what the cash was FOR. An entry can have several
  -- counter-lines (a bill paid across two expense accounts), so the cash movement is attributed to each
  -- in proportion to that counter-line's share of the entry's non-cash value.
  select
    e.id as entry_id,
    l.id as counter_line_id,
    a.type    as acct_type,
    a.subtype as acct_subtype,
    a.code    as acct_code,
    (l.base_debit + l.base_credit) as counter_weight
  from fin_journal_lines l
  join fin_journal_entries e on e.id = l.entry_id
  join fin_accounts a on a.id = l.account_id
  where e.status = 'posted'
    and not exists (select 1 from fin_cash_accounts c where c.id = l.account_id)
),
weighted as (
  select
    cl.company_id,
    cl.period_id,
    cl.entry_date,
    cl.entry_id,
    co.acct_type,
    co.acct_subtype,
    co.acct_code,
    -- Attribute this cash movement to the counter-line in proportion to its weight. If the entry has no
    -- counter-line at all (cash-to-cash transfer between two bank accounts), it is excluded below — such a
    -- movement is NOT a cash flow for the company, merely a move between its own pockets, and counting it
    -- would inflate both inflow and outflow by the same amount.
    cl.cash_delta * (co.counter_weight / nullif(sum(co.counter_weight) over (partition by cl.entry_id), 0))
      as amount
  from cash_lines cl
  join counter_lines co on co.entry_id = cl.entry_id
)
select
  w.company_id,
  w.period_id,
  w.entry_date,
  case
    -- Operating: the business running.
    when w.acct_type in ('revenue','expense')                                   then 'operating'
    when w.acct_type = 'asset'     and coalesce(w.acct_subtype,'') in ('receivable','current','tax')
                                                                                then 'operating'
    when w.acct_type = 'liability' and coalesce(w.acct_subtype,'') in ('payable','current','tax')
                                                                                then 'operating'
    -- The system accounts we seeded, by code, so a missing subtype does not silently misfile them.
    when w.acct_code in ('1100','1200','2000','2100','2200')                    then 'operating'

    -- Investing: the things the business runs ON. (Empty until the asset register exists — Phase 8.)
    when w.acct_type = 'asset'     and coalesce(w.acct_subtype,'') in ('fixed','intangible','investment')
                                                                                then 'investing'

    -- Financing: owners and lenders.
    when w.acct_type = 'equity'                                                  then 'financing'
    when w.acct_type = 'liability' and coalesce(w.acct_subtype,'') in ('loan','long_term','borrowing')
                                                                                then 'financing'

    -- Anything else is SURFACED, not absorbed. See the header: a misclassified movement is invisible in
    -- the net change, so silence here would be a lie with a clean bill of health.
    else 'unclassified'
  end as section,
  w.acct_code,
  w.acct_type,
  w.acct_subtype,
  w.amount
from weighted w
where w.amount is not null;

-- The statement itself: one row per section per period, plus the net change in cash.
create or replace view fin_cash_flow_summary as
select
  company_id,
  period_id,
  section,
  sum(amount) as net_amount
from fin_cash_flow
group by company_id, period_id, section;
