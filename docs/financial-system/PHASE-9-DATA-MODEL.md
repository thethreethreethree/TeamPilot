# Phase 9 — Data Model Proposal (Platform & Governance)

**Status: PROPOSAL — but most of Phase 9 is ALREADY BUILT** (it was "build alongside earlier phases"
per the spec). This documents what's done vs the genuine gaps, and asks which gaps are worth building.

## Already built (verify, don't rebuild)

- **Role-based access control** (accountant / controller / CFO / approver / viewer) — `fin_roles` +
  `fin_effective_role()` + `fin_can_*` capability helpers, with the platform-role→CFO bridge (0116).
  Enforced at both the RPC and RLS layers (verified — the finance authz sweep + capability audit).
- **Segregation of duties** (enter ≠ approve) — enforced in every posting function (bill/invoice/
  expense/credit-note issue all reject `creator = approver`), plus the ledger's `approved_by <>
  created_by`.
- **Encryption at rest and in transit** — delegated to Supabase (your confirmed choice): disk
  encryption + TLS. No app-level field encryption was requested.
- **Backup and recovery** — Supabase platform (PITR / managed backups) — operational, not app code.
- **Data export** — the generic `/api/export/[entity]` + finance CSV exports (formula-injection
  hardened, CWE-1236). **Import** — banking CSV (0145); a generic import is a gap.

So RBAC, SoD, encryption, backup are **DONE**. Phase 9's remaining work is the items below.

## Genuine gaps (the decisions)

1. **Approval delegation** — let an approver delegate their authority (e.g. while on leave) to another
   for a date range. Small: a `fin_approval_delegations` table (from_user, to_user, from/to dates) that
   `fin_can_approve()` consults. Build now? **Recommend yes** — it's small and real.
2. **Multi-entity support & consolidation** — multiple legal entities under one account, with
   consolidated statements (eliminating inter-company). This is a **large** structural change (every
   fin_ table is currently single-company-per-tenant; multi-entity adds an entity dimension +
   consolidation + inter-company elimination). Only worth it if you actually operate multiple entities.
   **Recommend defer** unless you do — tell me if you need it.
3. **Expanded integration layer** — Stripe / payment processors, external accounting (QuickBooks/Xero)
   sync, Plaid (the banking Plaid drop-in). Each is a separate integration with its own auth + cost.
   **Recommend prioritize on demand** — name the one you want first (Stripe is the usual first).
4. **Generic import / migration tools** — CSV/JSON import for opening balances + historical data (to
   migrate off a prior system). Useful at onboarding. Build now? Recommend a **trial-balance import**
   (opening balances) as the highest-value first piece.

## Decisions I need

1. **Approval delegation** — build now (recommended), or defer?
2. **Multi-entity** — do you operate multiple legal entities needing consolidation? (Recommend defer
   unless yes — it's a large structural change.)
3. **Integrations** — which first, if any? (Stripe / QuickBooks-Xero / Plaid / none yet.)
4. **Opening-balance / migration import** — build a trial-balance import now, or later?

## If confirmed (likely first increment)

`0154` approval delegation (`fin_approval_delegations` + wire into `fin_can_approve`) + an
opening-balance import (a guarded RPC that posts a balanced opening entry from a trial balance), with
acceptance tests. Multi-entity + specific integrations are each their own larger effort, sequenced when
you need them.

## AMD-006 four-layer check

- **L1 structure** — delegation is a small lookup consulted by the existing capability helper; opening
  balances post a normal (balanced) journal entry. No parallel structures. Multi-entity WOULD be a
  structural change — hence flagged, not assumed.
- **L2 / L3 / L4** — delegation: an approver sets a delegate → the delegate can approve in the window;
  a Governance/Settings surface lists delegations. Import: paste/upload a trial balance → a balanced
  opening entry posts.
