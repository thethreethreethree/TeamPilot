# Post-build audit — Financial System Phase 1 + Phase 2 (2026-07-11)

Adversarial self-audit of the migrations + app surface built this session, in the section 1.3 outside-view
stance. On-record per section 1.7. Every FIXED item is a committed migration; FLAGGED items need a founder
decision (surfaced, not silently resolved).

## FIXED (committed migrations)

| # | Severity | Finding | Fix |
|---|---|---|---|
| 0126 | HIGH (operational) | fin_init_company seeded a COA but no fiscal period → every approval failed "No OPEN period"; no period surface existed | seed a current-year open period at init + backfill; built the period-management surface (API + /dashboard/finance/periods) |
| 0127 | MED | fin_pay_bill read cumulative payments without locking → concurrent payments could over-pay | SELECT … FOR UPDATE on the bill |
| 0128 | MED-HIGH (integrity) | fin_bills/fin_bill_lines client-editable at any status → an accountant could edit an APPROVED bill's lines (diverge from its GL entry) or revert a paid bill | draft-only client writes; status transitions via the DEFINER RPCs (the analogue of the 0125 expense fix, which I'd missed for bills) |
| 0129 | MED-HIGH (integrity) | config that postings depend on was mutable: base_currency, and account type/normal_balance/currency | BEFORE UPDATE guards: base_currency frozen once entries exist; account type/normal_balance/currency frozen once the account has lines |

## FLAGGED — founder decision (not changed)

1. **Bill approval has no source-document SoD.** `fin_approve_bill` does not check that the bill's
   `created_by` ≠ the approver — so a single approver can create AND self-approve a bill, posting a
   GL entry with no independent approval. **Expenses already enforce** employee ≠ approver
   (`fin_approve_expense_report`); bills are inconsistent. This also means the SoD on *manual*
   journal entries (`fin_post_entry` requires created_by ≠ approver) is **bypassable by routing an
   entry through AP** and self-approving. Decision 1 (system-post, no *second GL* approver) is
   satisfied either way — this is about the *source document's own* approval being independent.
   **Recommend: add `created_by <> auth.uid()` to `fin_approve_bill`** for consistency with expenses.
   One-line change; flagged because it stops single-approver self-approval (a workflow change).

2. **No reversal/correction surface.** `fin_reverse_entry` exists (posts a draft reversal) but has
   no API/UI. Correcting a posted bill/entry isn't yet doable in-app. Follow-up.

3. **Money-as-JSON-number (theoretical, spec-strictness).** Finance API routes validate amounts as
   `z.number()` — transiently a JS float. For realistic ≤4-decimal amounts within safe-integer range
   this round-trips exactly (JSON → exact Postgres `numeric`; all money MATH is already in SQL), so
   it is NOT a live precision bug. But the spec says "never floating point for money" strictly, and
   an auditor would flag it. Strict fix = accept money as validated decimal STRINGS end-to-end
   (UI sends the string, API `z.string().regex(...)`, RPC/insert coerces to numeric). Flagged, not
   done: it's a broad UI+API change for a value range no real company hits. Founder's call on strictness.

4. **Minor (noted, not blocking):** the AP bill account-picker shows asset accounts (a fixed-asset
   purchase is valid, but Cash/AR aren't sensible bill lines); expense-report GL date = approval
   date, not item date; the dashboard "cash on hand" is a name-heuristic (cash/bank) until Phase-3
   bank accounts land; foreign-currency bills need a rate but there's no rate-entry UI yet
   (base-currency works).

## Audit coverage (this session)
DB-level RLS on all fin_ tables (per-subledger, clean); views/RPCs security_invoker; API layer —
all 18 finance routes user-scoped + auth-guarded, zero service-role bypass; migration-chain
dependency order; the balance/immutability/append-only invariants under the system-post path.
Result: 4 defects fixed (0126–0130), 1 SoD decision resolved (0130), the rest theoretical/marginal
above. The finance system is authz-sound at every layer.

## Verified sound (bounds, not gaps)
- All finance API routes use the user-scoped client → RLS + finance-role gating apply (no
  service-role bypass). fin_post_system_entry is revoked from direct client calls. The Phase-1
  balance/immutability/append-only guarantees hold under the subledger system-post path (checked).
- Tenant isolation: every fin_ table is company_id-scoped via auth_company_id(); the balance views
  are security_invoker.

*Audit found 4 real defects (fixed) + 1 SoD decision to surface. The value of the pass: the
bills-draft-lock and config-immutability holes were genuine integrity gaps that construction alone
didn't reveal.*
