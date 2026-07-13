# Phase 5 remainder — cash-flow forecasting & scenario planning

**Status: PROPOSED. Not built.** Per FinancialSystem.md §2.2.3, implementation code does not get written
until you confirm the model. Built already in Phase 5 increment 1: budgets, budget variance, runway (0149).

---

## The decision that defines this feature

There are two ways to build a cash-flow forecast, and they are not variations on a theme. They are
different products that produce the same-looking number.

### Option A — Forecast from COMMITTED obligations (recommended)

The forecast is assembled from things that have **already happened** and carry a **known future date**:

| Inflow | Source | Already in the ledger? |
|---|---|---|
| Unpaid invoices | `fin_invoices` (sent, minus credit notes) + `due_date` | Yes |
| Scheduled receipts | AR aging buckets | Yes |

| Outflow | Source | Already in the ledger? |
|---|---|---|
| Approved unpaid bills | `fin_bills` (approved) + `due_date` | Yes |
| Scheduled payments | `fin_payment_schedules` (0158) | Yes |
| Recurring bills | `fin_recurring_bills` (0140) — next N occurrences | Yes |
| Payroll | `fin_payroll_runs` (0167) — next run, from the last one's shape | Yes |
| Depreciation | **Excluded** — it is not a cash flow | — |

Every line in the forecast is **traceable to a document a human created**. The forecast says: *"Given what
you have already committed to, here is your cash position on each of the next 90 days."*

**What it cannot do:** predict revenue you haven't invoiced yet. It will look pessimistic to a growing
company, because it does not know about the deals in your pipeline.

### Option B — Forecast from statistical extrapolation

Take the last N months of cash movement, fit a trend, project it forward. Optionally seasonalize.

**This is the one I want to argue against, and it is the one that demos better.**

A trend-extrapolated forecast produces a smooth, confident, plausible line. It will be *right* most months,
because most months resemble the last one. It will be **catastrophically wrong exactly when it matters** —
when something changed, which is the only time anyone urgently reads a cash forecast. A company that loses
its largest customer sees a forecast that still projects that customer's revenue, drawn from the average of
the twelve months in which they were still paying.

And there is no signal at the moment of failure. The number looks exactly as authoritative as it did the
month before. **The founder makes a hiring decision against a line drawn from a past that no longer
exists.**

This is the §3.4 "no instant results" principle applied to money: a forecast that claims knowledge it does
not have is a lie that balances.

### My recommendation: **Option A**, with the gap stated out loud

Build the committed-obligations forecast. Then, on the same chart, show the **uncommitted gap** as an
explicitly-labelled band — *"you have £40k of committed inflow and £95k of committed outflow over the next
90 days; you need £55k from business you have not yet invoiced"*.

That framing is honest and it is **more useful**, because it converts a forecast into a target. It tells the
founder the number they actually need to hit, rather than reassuring them with an average.

**A26 note — this is the same finding as everything else this session.** The dangerous version balances,
looks right, and fails silently. The safe version refuses to invent the part it does not know.

---

## Proposed schema (if Option A is confirmed)

```sql
-- No new fact tables. A forecast is a LENS over documents that already exist — the same decision as the
-- 1099 report (0170) and the report builder (0171). A materialized forecast table would be a second copy
-- of the truth, and it would drift from the documents it claims to summarize.

create or replace view fin_cash_commitments as
  -- One row per known future cash movement, with its source document.
  select company_id, 'inflow'  as direction, due_date as expected_on,
         outstanding as amount, 'invoice' as source_type, id as source_id
    from fin_invoice_summary where status = 'sent' and outstanding > 0
  union all
  select company_id, 'outflow', due_date, (total - paid), 'bill', id
    from fin_bill_summary  where status = 'approved' and (total - paid) > 0
  union all
  select company_id, 'outflow', scheduled_for, amount, 'scheduled_payment', id
    from fin_payment_schedules where status = 'scheduled'
  -- + recurring bills (next N), + next payroll run
  ;

create or replace function fin_cash_forecast(p_days int default 90)
returns table (day date, inflow numeric(19,4), outflow numeric(19,4),
               closing_cash numeric(19,4), is_negative boolean)
-- Walks day by day from TODAY'S ACTUAL CASH BALANCE (read from the ledger, never assumed), applying
-- commitments as they fall due. is_negative marks the days you run out — which is the only output of this
-- function anyone will actually act on.
```

**Scenario planning** (the second half of the Phase-5 remainder) then becomes a thin layer: a scenario is a
set of **hypothetical commitments** (a hire at £X/month from date D; a customer paying 30 days late) laid
over the committed forecast. Crucially, the hypotheticals are **visibly distinct** from the committed lines
— a scenario must never be mistakable for a forecast.

---

## Decisions I need

1. **Option A or Option B?** (Recommend A.)
2. **The uncommitted gap** — show it as an explicit band, or leave the forecast purely committed?
   (Recommend showing it; a forecast without it looks alarmingly pessimistic and gets ignored.)
3. **Forecast horizon** — 90 days default? (Recommend 90; beyond that, committed data thins out and the
   forecast becomes fiction by omission.)
4. **Scenarios now, or after the forecast is in use?** (Recommend after — a scenario tool with nothing
   solid to overlay is a spreadsheet with extra steps.)

---

## AMD-006 four-layer check

- **L1 structure** — no new fact tables; a lens over existing documents, consistent with 0170/0171.
- **L2 effectivity** — the forecast is only as good as its commitments; it will be *right* about what it
  knows and *silent* about what it does not, which is the intended behaviour, not a limitation to fix.
- **L3 composition** — feeds the existing runway KPI (0165) and budget variance (0149). The banking page's
  cash position (0145) is the forecast's starting point, so the two must never disagree — the forecast
  reads the same ledger balance, never a cached copy.
- **L4 surface** — one chart, the days you go negative marked in red, and the uncommitted gap named. The
  single question a founder brings to this page is *"when do I run out of money?"*, and the page should
  answer it before it answers anything else.
