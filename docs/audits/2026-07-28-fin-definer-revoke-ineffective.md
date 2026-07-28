# FINDING (2026-07-28) — 0183's DEFINER revoke is INEFFECTIVE; finance DEFINER fns are anon-callable (cross-tenant read)

**Severity: MEDIUM** (confirmed cross-tenant read of financial CONFIG metadata via an unauthenticated,
RLS-bypassing SECURITY DEFINER function; practical exploit is gated by company_id being an unguessable
UUID, and the exposed data is chart-of-accounts structure / rates / limits, not amounts or PII). A real
tenant-isolation breach that a migration *intended* to close and did not, hidden behind a green guard.

## What / evidence (live, this session)

- `fin_account_by_code(p_company uuid, p_code text)` is SECURITY DEFINER (bypasses RLS) and has **no
  `auth_company_id()` gate** in its body.
- Live grants: `has_function_privilege('anon', …)` = **true**; `proacl = {=X/postgres, postgres=X/…,
  service_role=X/…}` — the `=X` entry is a grant to **PUBLIC**.
- **PoC (rolled back):** `set local role anon; select fin_account_by_code('<companyC>','1000');` →
  **returned that company's account UUID.** An unauthenticated caller read another tenant's data.
- The same ineffective-revoke affects the whole list `0183_fin_definer_revoke.sql` targeted (~50 fin
  DEFINER fns). The ungated READ helpers are the confirmed leak set: `fin_account_by_code`, `fin_get_rate`,
  `fin_inventory_accounts`, `fin_obe_account`, `fin_approval_limit_for`, `fin_mileage_rate_for`,
  `fin_per_diem_rate_for` (config/structure metadata). WRITE/action fns (`fin_approve_bill`, `fin_post_entry`,
  …) additionally gate on `auth.uid()` / `fin_can_*` internally, so anon can't write — but they are still
  needlessly exposed, and cross-tenant-write-by-an-authenticated-caller needs its own per-fn review.

## Why (root cause)

`0183` wrote `revoke execute on function fin_account_by_code(uuid,text) from authenticated, anon;`. In
Postgres, `anon`/`authenticated` hold EXECUTE **via the default PUBLIC grant** that `create or replace
function` (0122) applied. Revoking a role that only *inherits* from PUBLIC removes nothing — the PUBLIC
grant remains, so the role still executes. The effective fix is `revoke … from PUBLIC` (which strips anon +
authenticated while keeping the explicit `service_role`/`postgres` grants). This is the mirror of the pilot
lesson (revoke-from-anon vs revoke-from-public) — here the revoke named the roles instead of PUBLIC.

## Why the guard didn't catch it (INVARIANT 4 blind spot)

`scripts/invariant-audit.mjs` INVARIANT 4 marks a tenant-param DEFINER fn "safe" if a migration contains a
`revoke execute … from authenticated, anon` for it — it checks the revoke **text**, not the **effective
grant**. So an ineffective revoke (wrong grantee) reads as protected. The guard needs to require
`from public` (or verify the live grant), else it green-lights this exact no-op.

## Proposed fix (FOUNDER-GATED — finance schema change)

1. **Migration `0200`**: `revoke execute on function <each 0183-listed fn>(<sig>) from public;` — completes
   0183's clear intent correctly. Safe *iff* the app calls these only via entry functions (owner context)
   or `service_role`, never directly as `authenticated`. 0183 already revoked `authenticated`, so the intent
   was that they're internal-only — but **verify no app route calls them directly** before applying (a
   direct authenticated caller would break). NOT applied here — finance change with app-breakage risk (§2).
2. **Tighten INVARIANT 4** to require the revoke be `from public` (not just the roles), so this can't recur.
   Note: doing so will (correctly) turn the invariant RED until the migration lands — sequence the migration
   first, or gate behind the same PR.
3. Optionally add a **`verify:live`** check: the 0183-targeted fns must not be anon/authenticated-executable
   (detects the effective grant, complements the static text check).

_Method: confirmed by live grant inspection + a rolled-back anon PoC this session. The exposed data is
financial config metadata and exploit needs a known company UUID, hence MEDIUM not HIGH — but it is a
genuine RLS bypass an unauth caller can reach, and it should be closed._
