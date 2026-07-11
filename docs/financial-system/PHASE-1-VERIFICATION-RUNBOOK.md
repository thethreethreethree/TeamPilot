# Phase 1 — Verification Runbook

The one place that tells you how to move Phase 1 from **BUILT** to **TESTED**. Everything is
verified by construction only until you run this — I cannot execute Postgres headless.

## Step 1 — Apply the migrations (staging first)

Apply in order: `0116` → `0117` → `0118` → `0119` → `0120`. They are idempotent (safe to re-run).
Use your normal Supabase migration path (`supabase db push` or the SQL editor).

## Step 2 — Run the acceptance scripts (Supabase SQL editor / psql)

Each runs inside a transaction and **rolls back** — they leave no data behind. Read the `NOTICE`
output; **every line must say `PASS`.** A `FAIL` names the invariant that didn't hold.

| Script | Proves |
|---|---|
| [`tests/0116_foundation.test.sql`](tests/0116_foundation.test.sql) | COA type↔normal-balance (T-4), unique code (T-5), system-account protection (T-7) |
| [`tests/0117_periods.test.sql`](tests/0117_periods.test.sql) | period non-overlap (T-20), date/name constraints |
| [`tests/0118_ledger.test.sql`](tests/0118_ledger.test.sql) | debit-XOR-credit (T-10), **balance backstop** (T-8), posted immutability (T-14), closed-period immutability (T-18) |
| [`tests/0119_multicurrency.test.sql`](tests/0119_multicurrency.test.sql) | rate lookup, FX conversion + rounding (T-23/24), mixed-currency balances in base (T-22) |
| [`tests/0120_audit.test.sql`](tests/0120_audit.test.sql) | audit capture with before/after (T-27), append-only log (T-26) |
| [`tests/0116-0120_smoke_happy_path.test.sql`](tests/0116-0120_smoke_happy_path.test.sql) | **the system WORKS end-to-end**: post a balanced entry → trial balance nets zero (T-12) → derived balances drill to source (T-11) |

The first five prove *bad input is rejected*; the smoke test proves *good input flows and the math
is right*. Together = the Phase-1 DB-level correctness contract.

## Step 3 — What these scripts do NOT prove (the app-layer contract)

These need real authenticated requests, so they're verified once the finance **UI/API** exists,
against the app's existing RLS test pattern:

- **T-2 tenant isolation** — a user in company A cannot read/write company B's `fin_` rows.
- **RPC authority** — only approver/controller/cfo can `fin_post_entry`; only controller/cfo can
  close periods / write rates / configure.
- **Segregation of duties (T-15)** under a real user — `fin_post_entry` rejects `approved_by =
  created_by`.
- **The platform-role bridge** — a platform admin/CEO/COO resolves to CFO-level finance authority;
  an explicit `fin_role` overrides it.
- **`fin_init_company`** seeds settings + the standard COA for the caller's company.

## Step 4 — Record the result

When the SQL scripts all pass on staging, the six Phase-1 features move `BUILT → TESTED` in
`FEATURE_MANIFEST.md` (DB-level). The app-layer rows reach TESTED when the finance surface exists
and its integration tests pass. **Only then does Phase 2 begin** — and it starts with a Phase-2
data-model proposal for your confirmation, same gate as Phase 1.

---

*Correctness over speed. Nothing here is claimed TESTED until these run green on a real database.*
