# Phase 4 (remainder) — Data Model Proposal

**Status:** proposed 2026-07-14 · awaiting founder confirmation (§2.2.3)

The confirmed Phase-4 model built increment 1 (cost centers, projects, cost_type, margin-by-project /
by-cost-center views, `/profitability`). It then explicitly **deferred** the rest:

> *"Defer: overhead allocation, spend-anomaly ML, unit economics, break-even, inventory/shrinkage."*

The founder has since directed that everything be built. Two decisions were taken to unblock it:

- **COGS + inventory waste → built LAST, with the inventory system.** The founder holds physical stock, so
  real COGS is derived from stock movements and valuation. Building a services-style COGS now would mean
  building the same feature twice and reporting a *wrong* number in the interim. (§2.2.2: never build
  analytics on a foundation that isn't there yet.)
- **Overhead driver = DIRECT-COST SHARE.** A cost center carrying 30% of the company's direct costs
  absorbs 30% of overhead. It needs no new input data — it uses figures the ledger already holds — so
  there is no maintained side-table to quietly rot.

So this proposal covers **8 features**.

---

## The load-bearing decision: allocation is ANALYTICAL, not POSTED

Overhead allocation can be done two ways:

1. **Posted** — generate real journal entries moving indirect cost from an overhead pool into each cost
   center. The GL then *contains* the allocation.
2. **Analytical** — compute the allocation as a **view** over posted lines. The GL is untouched; the
   allocation is a lens on it.

**I propose analytical, and I want to be explicit about why**, because this is the choice that decides
whether a bad allocation rule can damage your books.

- A posted allocation writes entries into the ledger. Change the driver later and you must **reverse and
  re-post** every allocation entry ever made — across closed periods you cannot touch (§3: closed periods
  are immutable). A management-reporting choice would have permanently altered the statutory record.
- An analytical allocation is **recomputable and harmless**. Change the driver, and every historical
  figure re-derives instantly. The ledger never moves. The trial balance never shifts. Nothing to reverse.
- The ledger's job is *what actually happened*. Allocation is *how we choose to look at it*. Those are
  different claims, and the constitution's traceability rule (§3: every derived figure traceable to source
  transactions) is satisfied either way — a view drills straight through to the posted lines.

**Consequence you should know:** allocated cost will appear in profitability *reports* but not in the P&L
by cost center at the GL level. That is correct — but if you need allocation to appear in the statutory
ledger (some jurisdictions/auditors want it), say so and I will build the posted variant instead. **This
is the one thing in this proposal I'd most want you to push back on.**

---

## New tables (2)

```sql
fin_overhead_rules
  id, company_id,
  name                text        -- "Rent + admin"
  pool_account_id     uuid        -- the indirect-cost account being spread (or NULL = all cost_type='indirect')
  driver              text        -- 'direct_cost' (only value for now; the column exists so a second
                                  --  driver can be added without a migration to the shape)
  is_active           boolean
  effective_from      date        -- effective-dated: changing the rule must not revalue history
  created_by, created_at

fin_spend_baselines           -- for anomaly detection; recomputed, not authored
  company_id, account_id, cost_center_id,
  period_month        date
  mean_amount         numeric(19,4)
  stddev_amount       numeric(19,4)
  sample_months       int
  PRIMARY KEY (company_id, account_id, cost_center_id, period_month)
```

Everything else is **views over already-posted lines** — no new writes, nothing to keep in sync, nothing
that can drift from the ledger.

## New dimensions (2 columns, not tables)

`product` and `region` are needed for "gross margin by product/service/client/project/**region**" (the
PARTIAL feature). Rather than new dimension tables, add two nullable text columns to the invoice/bill line
level, tagged like `cost_center_id`/`project_id` already are:

```sql
fin_invoice_lines.product   text
fin_invoice_lines.region    text
fin_bill_lines.product      text
fin_bill_lines.region       text
fin_expense_items.product   text
fin_expense_items.region    text
```

**Why text, not a table:** a product/region taxonomy you must maintain is a table that rots the moment
someone renames a region. Free text tagged at the line, grouped in the view, is honest about what it is —
and if you later want a controlled vocabulary, promoting text → FK is a mechanical migration. Starting with
the table is the harder thing to undo.

## The 8 features → what each actually is

| Feature | Shape | Notes |
|---|---|---|
| **Overhead allocation** | `fin_overhead_allocation` view | pool × (cost center's direct cost ÷ total direct cost), per period |
| **Gross margin by product / region** | extend `fin_margin_*` views | completes the PARTIAL (project + cost center already built) |
| **Net profitability by segment** | `fin_net_profitability` view | gross margin **minus allocated overhead** — this is the feature overhead allocation exists to serve |
| **Unit economics** | `fin_unit_economics` view | cost & revenue per customer / per transaction (units derived from invoice + customer counts — no new input) |
| **Break-even** | `fin_breakeven` view | fixed (indirect) cost ÷ contribution margin ratio. Needs `cost_type` — already built in 0147 |
| **Idle / unused resources** | `fin_idle_resources` view | recurring bills still charging with **no activity** on their cost center/project in N months |
| **Spend anomaly detection** | `fin_spend_baselines` + `fin_spend_anomalies` view | a month's spend > mean + 2σ of its own trailing baseline. **Statistical, not ML** — see below |
| **Cost-per-outcome** | `fin_cost_per_outcome` view | spend on a project that produced **no revenue** — the spec's "spend that produced nothing" |

### Spend anomaly: statistical, not ML — deliberately

The deferred note said *"spend-anomaly **ML**"*. I am proposing **not** to build ML, and the reason is
§3.4/§5, not laziness: an ML anomaly score is a number nobody can audit. When it flags a €40k charge, the
CFO's first question is *"why?"* — and "the model said so" is exactly the confident-but-unexplainable answer
this constitution exists to refuse. A 2σ deviation from an account's own 12-month baseline is:

- explainable in one sentence to a non-technical person,
- traceable to the posted lines that produced it,
- and **falsifiable** — you can look at it and say "no, that's our annual insurance premium."

You can always add a model later. You cannot un-ship an unexplainable number that someone acted on.

---

## What I need to start

**Confirm this model** (§2.2.3), and in particular confirm the **analytical-not-posted** allocation call —
that is the one with a real trade-off, and reversing it later is expensive.
