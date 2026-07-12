# Spec-conformance audit — FinancialSystem.md vs. the build (2026-07-12)

A discrete pass against the **actual spec** (FinancialSystem.md), not a summary of it, checking the
section 3 non-negotiables and the section 2.1 rule that every feature reach a terminal state
(`BUILT` or `FLAGGED` with founder approval) — section 0's "nothing may be silently dropped." This is
the honest build report the governance asks for: what's met, what's partial, what's uncertain.

## Section 3 — Non-Negotiable Correctness Requirements

| Requirement | Status | Evidence / honest note |
|---|---|---|
| Ledger always balances, enforced at DB level | **MET** | 0118 two-layer: `fin_post_entry` inline check + deferred balance triggers on entries AND lines (fire at COMMIT), not app-code only. |
| Never floating point for money; exact decimal | **MET** | `numeric(19,4)` throughout; all money math in SQL. Audited end-to-end 2026-07-12 (AUDIT-2026-07-12-money-math-boundary.md) — no JS computes a stored/derived money value. |
| Every derived figure traceable to source (full drill-down) | **MET** | Statements: Trial Balance → click account → `fin_gl_detail` posted lines → `fin_source_postings` → source bill/invoice. The dashboard-gap noted in the first pass is **now closed** — every KPI card (Cash/Revenue/Expenses/Net → statements drill-down; Receivable → AR invoices; Payable → AP bills) links into where the figure traces to source (dashboard commit follows this audit). |
| Closed periods immutable | **MET** | 0117 close/lock + 0118 closed-period immutability trigger (rejects posting into non-open periods, even service-role). |
| All records append-only; corrections via reversals | **MET** | 0118 immutability triggers on posted entries/lines; `fin_reverse_entry` creates an SoD-preserving draft reversal; 0120 audit log is append-only (rejects UPDATE/DELETE). |
| Write tests for every calculation | **PARTIAL** | Tested: ledger balance (0118), FX (0119), config immutability (0129), aging boundaries (0133/0138), recurring dates (0140), statement helpers (TS, vitest). **Gap:** the subledger→GL posting *amounts* (`fin_approve_bill`, `fin_pay_bill`, `fin_issue_invoice`, `fin_record_receipt`, expense approve/reimburse — the Dr/Cr each computes) are verified-by-construction + structural acceptance scripts + live UI, but have no executable SQL acceptance test because they are `auth_company_id()`-gated (service-role returns empty; simulating auth needs fragile `auth.users` seeding). Closable by driving them through the app-layer integration tests (a real approver + open period), or a staging harness with a seeded auth user. |
| Encrypt at rest and in transit | **MET (delegated)** | Founder chose "existing Supabase encryption" — at-rest (Postgres/disk) + in-transit (TLS) handled by the platform. No app-level field encryption added (not requested). |

**Verdict:** 6 fully met (the dashboard drill-down follow-up was built same-session), 1 partial —
"test every calculation," where the subledger→GL posting amounts lack an *executable* SQL test
because they're auth-gated (covered by construction + structural scripts + live UI). No requirement
is unmet or faked.

## Section 2.1 — every Phase-2 feature at a terminal state (no silent drops)

Cross-checked all 18 Phase-2 spec items against FEATURE_MANIFEST.md — **every one is explicitly
tracked**; none is silently missing (section 0 satisfied). Summary:

- **BUILT (10):** vendor master, purchase orders, bill entry (manual), recurring bills, customer
  master, invoice generation, payment tracking/application, aging, expense submission, expense
  categorization, reimbursement workflow. (AP bill-capture + AR invoice both BUILT for the manual/
  in-app path; their integration extensions are the flags below.)
- **PARTIAL, explicitly flagged (4):** payment scheduling/execution (execution BUILT; scheduling +
  bank/processor exec = integration), approval + role-based spend LIMITS (approval BUILT; limits need
  founder $ values), dunning (collections worklist BUILT; email reminders = integration), invoice
  delivery (generation BUILT; email/PDF = integration).
- **DESIGNED, awaiting decision (1):** credit notes & refunds — CREDIT-NOTES-DATA-MODEL.md, 5 decisions.
- **NOT_STARTED, surfaced (3):** corporate-card reconciliation (integration), mileage/per-diem
  (needs rates), policy enforcement (needs policy rules).

**One honest section-2.1 nuance:** the 3 NOT_STARTED + 1 DESIGNED items are *surfaced and flagged*
(not silently dropped) but have not yet received the founder's **explicit** approve-to-defer or
build-decision. They are correctly in the open-items list (closure + manifest); they reach a true
terminal state when the founder either approves the defer or supplies the values/decisions. This is
the honest status — flagged and awaiting, not silently closed.

## Minor robustness observations (not conformance failures)

From a correctness review of `fin_dashboard_summary` + the balance views (2026-07-12):

- **Sign conventions verified sound.** `fin_account_balances.balance` normalizes by `normal_balance`
  (each type shows its natural positive), so `net_income = revenue − expenses`, every total is
  positive-natural, the balance sheet ties out (Assets = Liabilities + Equity + Net Income, correct
  pre-close), and the trial-balance difference is 0 when balanced. No sign/classification bug.
- **`cash_on_hand` uses a name heuristic** (`name ilike '%cash%' or '%bank%'`). Correct for the seeded
  COA (1000 Cash), but fragile: a renamed cash account is missed, and a misleadingly-named asset
  (e.g. "Petty Cash Advance *Receivable*") would be wrongly counted as cash. **Flag, not a bug** — the
  robust fix is an explicit cash designation (a `is_cash` flag or a code allowlist), which is a
  founder-gated model choice (what counts as "cash"?). Total assets/liabilities/equity are unaffected
  (they sum by type, not name); only the Cash-on-Hand KPI depends on the heuristic. 0121 is already
  applied, so any change ships as a new migration.

## What this pass did NOT do

Phases 3–9 are out of scope here (each is a future phase behind the per-phase proposal gate; Phase-3
is already proposed). This pass covers the built surface (Phases 1, 2, and the read-only Phase-6
statements) against the section 3 non-negotiables that apply to the *whole* system.
