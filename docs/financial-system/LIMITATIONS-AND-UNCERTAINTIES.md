# Limitations & Uncertainties — honest register (2026-07-12)

The founder's governance asked for "what you couldn't complete, what you changed and why, what
you're uncertain works — if untested, say untested." Those caveats are scattered across commits and
docs; this is the single honest place for all of them, so nothing is discovered by surprise during
apply. Grouped by *kind of uncertainty*.

## 1. Verified-by-construction, NOT yet runtime-verified

The entire Phase-2+ stack (0122–0140) is built and type-clean, and its DB-level invariants are
enforced by triggers/constraints — but **I have not run it against a live database**, and the
migrations 0122–0140 are **not yet applied** (you confirmed through 0121). Everything below the ledger
foundation is "correct by construction + code review," not "observed working":

- The subledger→GL postings (bill approve/pay, invoice issue/receipt, expense approve/reimburse) —
  I traced the Dr/Cr logic and it balances by construction, but no live post has been observed.
- The finance UIs (AP/AR/Expenses/Periods/Statements/POs/Recurring) — type-clean, never rendered by me.
- The dashboard figures moving when entries post — logically derived, not watched.

**To convert to founder-verified:** apply 0122–0140 and walk VERIFICATION-RUNBOOK-FULL.md. That is
the single most valuable action outstanding.

## 2. Untested by me (cannot run headless)

- **All SQL acceptance scripts** (docs/financial-system/tests/*.sql) — I cannot run SQL in this
  environment. They self-report PASS/FAIL via RAISE NOTICE and roll back; **you run them on staging.**
  The aging-bucket (0133/0138) and recurring-date (0140) scripts are new this session; the 0116–0132
  scripts predate it. I sanity-checked syntax by inspection (and caught two of my own errors — an
  invalid-hex UUID and a MySQL-ism — before commit), but "inspected" ≠ "executed."
- **`fin_statements` derivation** has no executable SQL acceptance test — it is `auth_company_id()`-
  gated and `profiles.id` FKs `auth.users`, so testing it needs fragile `auth.users` seeding I can't
  verify headless. Covered instead by pure-helper unit tests (vitest) + live UI (runbook Step 5).
- **The subledger→GL posting amounts** (approve/pay/issue/receipt) — same auth-gating; verified by
  construction + structural acceptance scripts + the runbook's live click-through, not by SQL test.
  This is the one section-3 non-negotiable ("test every calculation") standing at PARTIAL.

## 3. Flagged design decisions — need your call (nothing built unbid)

- **Credit notes / refunds** — DESIGNED, not built. CREDIT-NOTES-DATA-MODEL.md, 5 decisions
  (treatment [rec. contra-revenue 4900], application model, lines-vs-amount, over-credit, cash refunds).
- **Recurring monthly-drift** — a bill due the 31st drifts to the 28th permanently after February
  (Postgres month-clamp). Keep calendar +1 month / anchor-day / last-day-of-month? (test 0140 documents it.)
- **Cash-on-Hand heuristic** — identifies cash by account name (`ilike '%cash%'/%bank%'`); fragile to
  renamed/misleading names. Robust fix (is_cash flag / code allowlist) is a "what counts as cash" choice.
- **Expense submission access-model** — currently any company member can submit an expense report;
  flagged whether that should be role-restricted.

## 4. Need your VALUES (can't guess)

- Role-based **spend-limit** thresholds (approval workflow enforces SoD but no $ ceilings yet).
- **Mileage / per-diem** rates.
- **Expense policy** rules (disallowed categories, per-category limits).

## 5. Need an INTEGRATION decision (build-vs-buy)

- Bill **OCR / file ingestion** (manual entry works; OCR is a document-AI integration).
- **Corporate-card** reconciliation feed.
- Invoice **delivery** (email/PDF) and automated **dunning** reminders (collections worklist is built).
- Phase-3 **bank feed** (CSV import vs Plaid — see PHASE-3-DATA-MODEL.md).

## 6. Deferred by design / later phase

- FX **on payment/settlement** is rejected (not mis-posted) for non-base currency; period-end
  unrealized FX revaluation is later.
- Recurring **auto-generation** batch runner (`fin_run_due_recurring`) is dormant — needs a cron with
  a service context (and a service-role, all-companies variant, since the current one is auth-scoped).
- Cash Flow Statement, PDF/native-xlsx export, period-over-period statements — Phase-6 later increments.
- Phases 3–9 — each behind the per-phase proposal gate (Phase-3 already proposed).

## What I am confident IS correct

Not everything is uncertain. Verified this session with real analysis (not assumption): DB-level
balance enforcement (two-layer); no floating-point money (audited end-to-end); RPC capability
enforcement (two-layer, all write RPCs); migration idempotency + dependency-order; dashboard-summary
sign conventions (net income, tie-out, trial balance); CSV export hardened against formula injection;
finance routes never use the service-role client. These are recorded in the AUDIT-2026-07-12-*.md and
SPEC-CONFORMANCE-2026-07-12.md docs.
