# Phase 5 — Data Model Proposal (Budgeting & Forecasting)

**Status: PROPOSAL — awaiting confirmation.** Builds directly on Phase 4: a budget is a set of target
amounts per account (and optionally per cost-center/project) per period, and **budget-vs-actual is
just the budget compared to the posted actuals** — which Phase 4 already lets us slice by dimension.
So the expensive part is done; Phase 5 mostly adds the *targets* and the comparison. Like Phase 4,
this proposal scopes a **first increment** because the phase spans easy (runway) to hard (scenario
modeling).

## Principle

Budgets are **targets laid over the actuals**, never a second source of truth. Actuals come from the
posted ledger (sliced by period + dimension, Phase 4); the budget is the plan; variance = actual −
budget. Forecasts extend the actual trend forward; they are clearly labeled as *projections*, never
mixed into the booked numbers (section 3.4 — don't present a guess as a fact).

## Proposed tables (first increment)

1. **`fin_budgets`** — a budget version: `name`, `fiscal_year`, `granularity` (`annual` | `quarterly`
   | `monthly`), `status` (`draft` | `active` | `archived`), `created_by`. One can be `active` per
   year (the rest are scenarios/history).
2. **`fin_budget_lines`** — the targets: `budget_id`, `account_id`, **`cost_center_id`** (nullable),
   **`project_id`** (nullable), `period_index` (1–12 month or 1–4 quarter or 0 = whole year), `amount`.
   A budgeted figure for an account × dimension × period. Reuses the Phase-4 dimension keys, so
   variance lines up exactly with how actuals are tagged.

## Derivations (views/RPCs — no stored variance)

- **Budget vs actual** — `fin_budget_variance(budget_id)`: join budget lines to posted actuals grouped
  by the same account × dimension × period; `variance = actual − budget`, `variance_pct`. Revenue
  under-budget and expense over-budget are the "bad" directions (colored accordingly).
- **Variance alerts** — a threshold flag: surface lines where `|variance_pct|` exceeds a company
  setting (default e.g. 10%). Threshold is a *value* — see decisions.
- **Runway** — derivable now, no assumptions: `cash_on_hand / average_monthly_net_burn` (burn = the
  trailing-N-month average of expense − revenue when negative). A single honest number + the months.

## Deferred to a later increment (flagged, not built)

- **Rolling forecasts** (re-forecast each month from the latest actuals), **cash-flow projection**
  (needs AP/AR due-date timing + recurring commitments — some of it is derivable from aging +
  recurring, some needs assumptions), and **scenario modeling** ("what if revenue drops 20%" — needs a
  scenario/assumptions model). These are genuinely more complex and partly need business assumptions;
  recommend a second increment once budget-vs-actual is in use.

## Decisions I need before building

1. **Budget dimensionality** — budget by account only, or account × cost-center (× project)? Recommend
   **account × cost-center** (matches the spec "by department & cost center"); project budgets already
   exist as `fin_projects.budget` for project-level variance.
2. **Period granularity** — annual, quarterly, or monthly buckets? Recommend **quarterly** (with an
   annual roll-up) as the default; monthly is more work to enter. Confirm.
3. **Variance-alert threshold** — a single company default (e.g. 10%)? Give the number, or confirm 10%.
4. **First-increment scope** — recommend: budget creation + budget-vs-actual + variance + variance
   alerts + runway. **Defer** rolling forecasts, cash-flow projection, scenario modeling to increment 2.
   Confirm, or pull one of the deferred items forward.

## AMD-006 four-layer check

- **L1 structure** — budgets/lines reuse the Phase-4 dimension keys + period buckets; variance is a
  view over budget vs posted actuals. No parallel ledger.
- **L2 effectivity** — enter a Q1 budget for a cost center, post actuals, and the variance view shows
  the gap, end-to-end.
- **L3 continuity** — a Budgets page: create/enter a budget, then a variance table by account ×
  dimension × period; runway on the dashboard.
- **L4 surface** — budget entry grid + variance report (color-coded good/bad by direction) + a runway
  readout.

## If confirmed

One migration `0149` (fin_budgets + fin_budget_lines + fin_budget_variance view + a variance-threshold
setting) plus a Budgets page (entry grid + variance report), a runway readout on the dashboard, and
acceptance tests for the variance math. Rolling forecast / cash-flow / scenario = increment 2.
