# Session closure — Financial System build (2026-07-11)

Single entry point for the founder's return. This session built the Financial Tracking &
Management System (FinancialSystem.md) from nothing to an operational Phase-1 + Phase-2 core.

## What was built (migrations 0116–0125 + finance app surface)

**Phase 1 — Foundation (VERIFIED by founder: all acceptance scripts PASS)**
- 0116 settings + finance roles + capability helpers + platform-role→CFO bridge + Chart of Accounts
- 0117 fiscal periods (open/close/lock, non-overlap)
- 0118 double-entry ledger — two-layer DB-level balance enforcement (post-RPC + deferred triggers),
  debit-XOR-credit, SoD, posted/closed-period immutability, reversal
- 0119 multi-currency (rates + authoritative FX + fin_init_company COA seed)
- 0120 immutable append-only audit trail (generic trigger on all fin_ tables)
- 0121 derived-balance views + fin_dashboard_summary (all money math in SQL)

**Phase 2 — Transactions (verified by construction; runtime-verifiable via the UI now)**
- 0122 subledger→GL primitive (fin_post_system_entry) + source-linking + fin_account_by_code
- 0123 AP core — vendors, bills+lines, fin_approve_bill→GL (Dr expense/Dr tax / Cr AP)
- 0124 AP payments — fin_pay_bill→GL (Dr AP / Cr Cash), partial + over-pay guard
- 0125 Expenses — reports/items, approve→GL (SoD: not your own) → reimburse→GL

**Post-build adversarial audit (0126–0129) — 4 genuine issues found + fixed**
- 0126 fin_init_company seeds an open period (fresh company couldn't post → would break verification)
- 0127 fin_pay_bill locks the bill row (over-payment race)
- 0128 AP bills editable only while DRAFT (edit-after-approval integrity — missed analogue of the 0125 expense fix)
- 0129 config-immutability guards (base_currency + account type/normal_balance frozen once used)

**App surface**
- Finance dashboard wired to the real ledger (Initialize CTA, real Cash/Revenue/Expenses/Net,
  trial-balance integrity badge, real expense breakdown; AR/burn/runway honestly deferred, not mocked)
- API: /api/finance/summary, /init, /accounts, /periods(+/[id]), /ap/vendors, /ap/bills(+/[id]/approve,/pay),
  /expenses/reports(+/[id])
- UI: /dashboard/finance/{ap, expenses, periods} (functional first-pass, single-line/no-tax)

**APPLY STATE: founder confirmed applied through 0121. Migrations 0122–0129 built this session
still need applying** before the Phase-2 features + audit fixes take effect.

## Governance record (the founder ran a strict per-phase protocol)

- Confirmed build params (7): multi-tenant RLS, existing stack, numeric(19,4) math-in-SQL, manual-FX
  API-ready, separate finance-role dim + exec/admin approval + SoD, COMPLETE from-scratch GL, Supabase encryption.
- Phase-1 model confirmed (5 decisions); Phase-2 model confirmed (bridge=A, system-post, tax-capture-only).
- **§0 correction (RESOLVED 2026-07-12):** the CRM is vendor-side only, so the original "Option A
  bridge" couldn't serve customer tenants. Founder chose **Option B (finance-native AR)** — BUILT
  (0131 fin_customers+fin_invoices+issue→GL, 0132 receipts→GL, + API/UI). Founder also confirmed
  adding **bill-approval SoD** (creator≠approver, 0130). **Phase-2 core (AP + AR + Expenses) is now
  COMPLETE + operational.** Migrations to apply: **0122–0132**.

## 5 real defects self-caught + fixed before commit (all verified-by-construction only)
1. FX reversal negated at the wrong (reversal-date) rate → wouldn't balance; fixed via a trust flag.
2. Deferred balance trigger only on lines (never fired at post) → added the entries-level trigger.
3. fin_reverse_entry self-approved (broke SoD) → now a draft posted through the normal path.
4. Expense items editable after approval + employee self-approve via direct status write → RLS tightened.
5. A messy vendors route → rewritten with getCurrentCompanyId.

## What NEEDS the founder (open)
1. **Verify Phase 2** by click-through: Finance → Manage AP → add vendor → bill → approve → pay;
   confirm the dashboard AP/Cash/Expenses move and Books stay Balanced. (Phase-1 SQL scripts already PASS.)
2. **AR direction: B / A' / Hybrid** (recommend B) — unblocks the last Phase-2 core subsystem.
3. Phase-2D enrichment VALUES (spend-limit thresholds, mileage rate, expense policy).
4. Phases 3–9 each start with a data-model proposal + confirmation (per-phase gate).

## Key files
- FEATURE_MANIFEST.md (status of every feature) · docs/financial-system/ (data-model proposals,
  acceptance tests, runbook) · supabase/migrations/0116–0125 · src/app/dashboard/finance/ + src/app/api/finance/
