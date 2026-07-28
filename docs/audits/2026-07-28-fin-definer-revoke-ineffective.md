# FINDING (2026-07-28) — 0183's DEFINER revoke is INEFFECTIVE; finance DEFINER fns are anon-callable (cross-tenant read)

**Severity: MEDIUM** — and note this is **the exact vulnerability `0183` itself found, documented, and
believed it fixed** (its header: "MEDIUM (cross-tenant read + cross-tenant write into the chart of
accounts)... Fixed here."). This finding is that **`0183`'s fix is INEFFECTIVE — the hole it closed is still
open** (confirmed live). It is cross-tenant READ (account ids / rates / limits) **and limited cross-tenant
WRITE**: `fin_obe_account(p_company)` and `fin_inventory_accounts(p_company)` INSERT accounts into an
arbitrary company's chart of accounts, both anon-executable and ungated. Practical exploit is gated by
company_id being an unguessable UUID and the impact is COA structure/config (not amounts/PII), hence MEDIUM.
The finance ENTRY/action fns (`fin_approve_bill`/`fin_post_entry`/`fin_pay_bill`) are NOT affected — they
verify `entity.company_id = auth_company_id()` (e.g. fin_approve_bill line 14 `v_company <> auth_company_id()
→ raise`) and require a non-null `auth.uid()`, so neither anon nor a cross-tenant authenticated caller can
abuse them (verified this session).

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
   0183's intent correctly (PUBLIC strips anon + authenticated; the explicit `service_role`/`postgres` grants
   remain). **0183's list is the ~8 tenant-param INTERNAL helpers, NOT the entry/action functions** — the app
   calls entry fns (`fin_approve_bill`, etc., which stay untouched and are already safe), and those call the
   helpers in owner context. So revoking the helpers from PUBLIC should NOT break the app. Still recommend a
   quick grep that no `supabase.rpc('<helper>')` names them directly before applying (§2 finance-change
   caution). NOT applied here.
2. **Tighten INVARIANT 4** to require the revoke be `from public` (not just the roles), so this can't recur.
   Note: doing so will (correctly) turn the invariant RED until the migration lands — sequence the migration
   first, or gate behind the same PR.
3. Optionally add a **`verify:live`** check: the 0183-targeted fns must not be anon/authenticated-executable
   (detects the effective grant, complements the static text check).

## Fix is de-risked (verified this session)

Grepped `src/` for direct `supabase.rpc('<helper>')` calls to all 7 applied helpers
(`fin_account_by_code`, `fin_obe_account`, `fin_inventory_accounts`, `fin_get_rate`,
`fin_approval_limit_for`, `fin_mileage_rate_for`, `fin_per_diem_rate_for`) → **NONE are called directly by
the app.** They're internal helpers invoked by entry functions in owner context. So `revoke … from public`
(which keeps the explicit `service_role`/`postgres` grants) will not break the app.

### Ready-to-apply `0200` (NOT applied — founder runs `db:apply` after a final glance; §2 finance change)
```sql
-- 0200 — fix 0183: revoke from PUBLIC (not the roles) so anon/authenticated lose the inherited grant.
revoke execute on function fin_account_by_code(uuid, text)                 from public;
revoke execute on function fin_obe_account(uuid)                           from public;
revoke execute on function fin_inventory_accounts(uuid)                    from public;
revoke execute on function fin_get_rate(uuid, character, character, date)  from public;
revoke execute on function fin_approval_limit_for(uuid, uuid)              from public;
revoke execute on function fin_mileage_rate_for(uuid, date, text)          from public;
revoke execute on function fin_per_diem_rate_for(uuid, date, text)         from public;
-- (fin_post_system_entry was already revoked in 0122; confirm its grant too.)
```
Verify after: `has_function_privilege('anon', 'fin_account_by_code(uuid,text)', 'execute')` → false.
Then tighten INVARIANT 4 (require `from public`, or check the live grant) so the ineffective-revoke pattern
can't recur — sequence AFTER 0200 so the invariant doesn't go red on the open hole.

_Method: confirmed by live grant inspection (`proacl`), a rolled-back anon PoC (cross-tenant read), reading
`fin_approve_bill` (entry fns are company-scoped + safe), and a src grep (helpers not app-called). Exposed
data is financial config metadata + limited COA-account insertion, exploit needs a known company UUID →
MEDIUM. It is the vuln 0183 documented as fixed; 0183's revoke was ineffective, so it is still open._
