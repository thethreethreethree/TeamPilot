# Phase 8 — Data Model Proposal (Payroll & Assets)

**Status: PROPOSAL — awaiting confirmation.** Two loosely-related areas. **Payroll** the spec itself
says "integration with an existing provider is acceptable and likely preferred" — I agree: don't
rebuild payroll, *post* it. **Assets** (fixed-asset register + depreciation) is real in-app
double-entry accounting worth building. **Inventory** stays deferred — consistent with your
services-style COGS choice in Phase 4 (you don't carry stock).

## Part A — Payroll (recommend: integration, not a payroll engine)

Building tax-accurate payroll (withholding tables, filings, direct deposit) is a regulated product in
itself and a bad use of this system. Instead:

- **`fin_payroll_runs`** — a posted summary per pay period from your provider (Gusto/Deel/etc. or a
  manual entry): `period_start/end`, `pay_date`, gross_wages, employer_taxes, benefits, net_paid,
  withholdings. `fin_post_payroll_run` posts the standard entry: **Dr Salary Expense (gross) + Dr
  Payroll-Tax Expense (employer) + Dr Benefits Expense / Cr Cash (net) + Cr Payroll-Tax Payable
  (employer taxes + employee withholdings) + Cr Benefits Payable**.
  Employee compensation tracking = the sum of runs per employee (a nullable `employee_ref`).

  > **Balance rule the build MUST honor (caught in proposal review):** `gross = net + withholdings`, so
  > the Payroll-Tax Payable credit must carry **employer taxes *plus* employee withholdings** (or split
  > withholdings into their own `Withholdings Payable`). Crediting only employer taxes leaves the entry
  > unbalanced by the withholdings amount — the posting primitive would (correctly) reject it. The
  > posting fn computes the payable-credit from the run fields so debits = credits by construction.
- **Payroll tax liabilities** = the Payroll-Tax Payable account balance (already how the ledger works).

So Part A is a **posting endpoint + a small entry form / CSV import**, not a payroll system.

## Part B — Assets (build in-app — real double-entry)

1. **`fin_fixed_assets`** — `name`, `asset_account_id` (the fixed-asset GL account), `acquired_date`,
   `cost`, `salvage_value`, `useful_life_months`, `method` (`straight_line` [+ later `declining`]),
   `accumulated_dep_account_id`, `dep_expense_account_id`, `status` (`active`/`disposed`),
   `disposed_date`.
2. **`fin_depreciation_entries`** — one row per posted depreciation period, linking to the GL entry
   (append-only). `fin_run_depreciation(asset_id | all, period)` posts **Dr Depreciation Expense / Cr
   Accumulated Depreciation** for the period's amount (straight-line: `(cost − salvage) /
   useful_life_months` per month). Idempotent per (asset, period) so re-running doesn't double-post.
3. **Disposal** — `fin_dispose_asset(asset_id, proceeds)`: **Dr Cash (proceeds) + Dr Accumulated
   Depreciation / Cr Fixed Asset (cost) + Cr/Dr Gain-or-Loss on Disposal** for the difference.

Net book value per asset = cost − accumulated depreciation (derived). A register view lists assets
with cost, accumulated dep, NBV, and monthly dep.

> **Correctness rules the build MUST honor (caught in proposal review):**
> - **Salvage floor** — depreciation stops once accumulated depreciation reaches `cost − salvage`
>   (i.e., after `useful_life_months`); a run must never drive NBV below salvage. The last period's
>   amount is clamped to the remaining depreciable base, not a full monthly slice.
> - **Active-only** — `fin_run_depreciation('all', …)` depreciates only `status = 'active'` assets;
>   disposed assets are skipped (they were closed out at disposal).
> - **Gain/loss = `proceeds − NBV`** where `NBV = cost − accumulated_dep` at the disposal date: a
>   positive difference credits Gain on Disposal, a negative one debits Loss. The entry balances by
>   construction (Dr Cash + Dr Accum Dep + [Dr Loss] = Cr Fixed Asset + [Cr Gain]).
> - **Open period** — depreciation and disposal post through `fin_post_system_entry`, so the target
>   period must be open (inherited; closed periods are rejected as everywhere else).

## Decisions I need before building

1. **Payroll** — integration/posting model [recommended], or do you want more (per-employee detail,
   benefits breakdown) in the first increment? Or **defer payroll entirely** if you post salaries as
   normal bills/expenses today?
2. **Depreciation method** — straight-line only for the first increment [recommended], or also
   declining-balance now?
3. **Depreciation cadence** — monthly auto-run [recommended] vs annual? And do you want a cron to
   auto-post it, or a manual "run depreciation" button (like the recurring-bills batch)?
4. **First-increment scope** — recommend: **Assets** (register + straight-line depreciation + disposal)
   + a **payroll-posting** endpoint/form. **Defer:** full payroll detail, declining-balance,
   inventory.
5. Confirm **inventory stays deferred** (services-style, no stock) — or flag if you do carry inventory.

## AMD-006 four-layer check

- **L1 structure** — assets/depreciation are their own tables but every depreciation + disposal is a
  real posted journal entry (section 3.1); payroll is a posting summary, no parallel ledger.
- **L2 effectivity** — register an asset, run depreciation → Dr dep expense / Cr accum dep posts and
  NBV drops; post a payroll run → the wage/tax/cash entry lands, end-to-end.
- **L3 continuity** — an Assets page (register + run-depreciation + dispose); a Payroll page (post a
  run). Depreciation could ride the same dormant-cron pattern as recurring bills.
- **L4 surface** — asset register table with NBV; a payroll-run form.

## If confirmed

Likely `0152` (fin_fixed_assets + fin_depreciation_entries + fin_run_depreciation + fin_dispose_asset
+ seed Depreciation Expense / Accumulated Depreciation / Gain-Loss-on-Disposal accounts) and `0153`
(fin_payroll_runs + fin_post_payroll_run + payroll accounts), plus an Assets page and a payroll-posting
form, with acceptance tests for the depreciation schedule + disposal gain/loss + payroll entry balance.
Inventory = a separate later phase if ever needed.
