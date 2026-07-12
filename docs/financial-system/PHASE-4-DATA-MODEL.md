# Phase 4 — Data Model Proposal (Cost, Profitability & Waste)

**Status: PROPOSAL — awaiting confirmation.** The spec calls this "the analytical core of the system,"
and it is the largest phase — so this proposal also asks you to confirm a **first-increment scope**,
not just a schema. Nothing is built until you confirm the decisions below.

## Principle

Profitability and cost analysis are **slices of the existing GL**, not a parallel set of numbers. The
ledger already knows *what* was spent and earned (by account); Phase 4 adds *dimensions* — cost
center, project, customer/segment — so the same posted lines can be grouped to answer "which client
/ project / department actually makes money." No figure is re-entered; everything ties back to a
posted journal line (the section-3 traceability rule still holds). Overhead allocation and anomaly
detection sit on top of that dimensioned ledger.

## The foundational decision — how dimensions attach to transactions

Everything in Phase 4 depends on tagging GL activity with dimensions. Two shapes:

- **(A) Dimension columns on the lines (RECOMMENDED).** Add nullable `cost_center_id`, `project_id`
  (and optionally `customer_id`) to `fin_journal_lines` AND to the subledger line tables
  (`fin_bill_lines`, `fin_invoice_lines`, `fin_expense_items`) so the tag flows from the source
  document into the posting. Profitability = `group by dimension` over posted lines. Simple, fast,
  ties directly to the GL. Downside: a fixed, small set of dimensions.
- **(B) A generic tagging table** (`fin_line_dimensions`: line_id, dimension_type, dimension_id).
  Arbitrary dimensions, but every report becomes a join + the "one tag per type per line" rule needs
  enforcing. More flexible, more complex, slower.

Recommend **(A)** — a fixed dimension set (cost center + project, + client via the existing
customer link on AR) covers the spec's "by product, service, client, project, region" with far less
complexity. Region/product can be modeled as cost-center or project attributes later.

## Proposed tables + columns (first increment)

1. **`fin_cost_centers`** — `name`, `code`, `parent_id` (a tree: Department → team), `is_active`.
2. **`fin_projects`** — `name`, `code`, `customer_id` (nullable link to `fin_customers`), `status`
   (active/closed), `start_date`, `budget` (nullable). Job/project costing groups by this.
3. **Dimension columns** `cost_center_id`, `project_id` (nullable, FK) on: `fin_journal_lines`,
   `fin_bill_lines`, `fin_invoice_lines`, `fin_expense_items`. The subledger posting functions
   (`fin_approve_bill` etc.) copy the tags onto the journal lines they create.
4. **`fin_account_cost_type`** *(or a column on `fin_accounts`)* — classify each account/line as
   **direct** vs **indirect** (spec: "direct vs indirect cost classification"). Recommend a
   `cost_type` column on `fin_accounts` (`direct` | `indirect` | `none`) as the default, overridable
   per line if needed later.

## Derivations (views/RPCs, no new stored numbers)

- **Margin by dimension** — `fin_profitability(dimension, from, to)`: revenue − direct costs grouped
  by cost center / project / customer, from posted lines tagged with that dimension. Contribution
  margin = revenue − variable(direct); gross margin at the product/segment level.
- **Customer / project profitability** — the same, keyed by `customer_id` / `project_id`.
- **Budget vs actual** — needs Phase 5 budgets OR a `fin_projects.budget` for project-level variance
  (a lightweight version shippable in Phase 4 for projects; company/department budgets are Phase 5).
- **Duplicate-payment detection** — a view flagging `fin_bills` with the same vendor + amount + near
  date (derivable now, no new model). A cheap, high-value "waste" win.

## Decisions I need before building

1. **Dimension attachment: (A) line columns [recommended] or (B) generic tagging table?**
2. **Which dimensions in the first increment?** Recommend **cost center + project** (+ client comes
   free via AR's customer link). Add region/product now, or model them later as attributes?
3. **Direct/indirect classification: a `cost_type` on the account [recommended], or per-line?**
4. **COGS** — do you sell physical goods (need real COGS/inventory), or services (COGS ≈ direct
   labor/subcontract to a COGS account)? This decides whether Phase 4 needs inventory (big) or just
   a COGS account + direct-cost tagging (small). Recommend **services-style** unless you carry stock.
5. **Overhead allocation rules** (allocate indirect cost across cost centers by a driver) — build now
   or defer? Recommend **defer** — it's complex, needs allocation-driver decisions, and margin-by-
   dimension delivers most of the value without it.
6. **First-increment scope.** Recommend: cost centers + projects + dimension tagging (bill/invoice/
   expense → GL) + margin/customer/project profitability views + duplicate-payment detection.
   **Defer:** overhead allocation, spend-anomaly ML, unit economics, break-even, inventory/shrinkage,
   cost-per-outcome (some of these need non-finance inputs or Phase-5 budgets).

## AMD-006 four-layer check

- **L1 structure** — dimensions as nullable FK columns on existing line tables; the posting functions
  copy tags through. No parallel ledger; everything derives from posted lines (fits section 3.1).
- **L2 effectivity** — tagging a bill line with a project, then the profitability view showing that
  project's margin from the posted entry, end-to-end.
- **L3 continuity** — dimension pickers appear in the multi-line editors already built (AP/AR/
  expenses); a Profitability page slices by dimension; drill-down to the tagged source lines.
- **L4 surface** — a Profitability/Cost page; dimension columns added to the existing line editors.

## If confirmed

Likely two migrations: `0146` (cost centers + projects + `cost_type` + dimension columns + the
posting-function updates to carry tags) and `0147` (profitability views + duplicate-payment view),
plus the dimension pickers in the line editors, a Profitability page, and acceptance tests for the
margin grouping + duplicate detection. Sequenced so the schema lands first, then the derivations.
