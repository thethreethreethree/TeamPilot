# Audit + fix — onboarding / company-creation / role-bootstrap (2026-07-07)

Guard-mandated §1.7 ground-up audit of the subsystem that assigns `company_id`
and `role` — the root of the whole authz model, and the class the earlier
vendor-CRM CRITICAL lived in. Every finding below was re-verified from source
before landing here (§A19/§A22), not taken from the auditor agent's word.

## CRITICAL — self-service privilege escalation via direct `profiles` UPDATE — FIXED (migration authored, founder must apply)

**File:** `supabase/migrations/0001_init.sql:110-111`
**Clause:** privilege-escalation / tenant-isolation (§A18); defeats the 0089 fix; §1.2 (the immutability-guard pattern existed on peripheral tables but never on the root table).
**Severity: CRITICAL.**

`create policy "own profile - update" on profiles for update using (id = auth.uid());`
— `USING` only, **no `WITH CHECK`**. Verified from source; grepped all migrations
0001–0089: no later `WITH CHECK`, no column `REVOKE`, no `BEFORE UPDATE` guard
trigger on `profiles` (the only profiles triggers, 0045, are care-state bootstrap).

**Exploit (one authenticated PostgREST call, bypasses all Next.js gates):**
```
PATCH /rest/v1/profiles?id=eq.<self>
{ "role": "admin", "company_id": "<vendor-or-any-tenant-uuid>" }
```
`auth_company_id()`, `getCurrentAuthContext().isAdmin`, `is_vendor_super_admin()`,
and the vendor/care/coach gates all read these columns straight from `profiles`.
Setting `company_id` to the (hardcoded, non-secret) vendor tenant grants vendor
super-admin — **the key predicate 0089 hardened is itself user-mutable, so 0089 is
defeated.** Setting it to any customer tenant grants full cross-tenant read/write.

**Fix — `supabase/migrations/0090_guard_profile_privileged_columns.sql` (authored, not yet applied):**
a `BEFORE UPDATE` trigger freezing `role` / `company_id` / `sales_coach_role` /
`is_support_agent` against direct `authenticated`/`anon` writes. `WITH CHECK` can't
express "may not change" (no `OLD`), so a trigger is required — composed from the
established `check_invitation_immutability()` pattern (0008:50, §A16) with a
privileged-context exemption. Block-list framing (`current_user in
('authenticated','anon')`) chosen deliberately: any misjudgement fails toward
"allow a privileged writer", never "block onboarding". SECURITY DEFINER RPCs
(`complete_company_onboarding`, `accept_invitation`) and service-role admin routes
run as non-end-user roles and pass through untouched.

**Coupled code change — `src/app/api/care/agent/settings/agents/route.ts`:** the
`is_support_agent` write was on the USER client; converted to service-role
(`createAdminClient`), still gated by `requireCompanyAdmin` + `.eq(company_id)`.
Without this the 0090 guard would reject the legitimate toggle. The conversion also
fixes a latent bug: under the user client + the self-only RLS policy, an admin
could previously toggle only their OWN `is_support_agent`, never a teammate's.

**Class check (§1.2, done):** swept every code writer of these four columns.
Only three exist — `is_support_agent` (fixed above), `sales_coach_role` (already
service-role, team route), and the RPCs for `role`/`company_id` (SECURITY DEFINER).
No `src/lib` writer, no server action. The care-agent-tenant `upsert` at
`care/agent/tenant/route.ts:165` targets `care_agent_tenants`, not `profiles`.

## Verified SOUND (from source, not assumed)

- `complete_company_onboarding` (0046/0047) — SECURITY DEFINER, `role='admin'`
  hardcoded server-side, `v_user_id := auth.uid()`, idempotent. `role` not
  parameter-derived.
- `accept_invitation` (0008:105) — SECURITY DEFINER; `company_id` forced to the
  invite's company, `role` forced to the invite's role. Joiner cannot influence
  either.
- `handle_new_user` (0011) — seeds `company_id=NULL`, `role=NULL` (§3.4 — never
  invents membership). The `role text default 'CEO'` column default (0001:27) is
  never reached: the trigger sets `role` explicitly to NULL.
- `/api/team` POST — invite `role` whitelist-validated, `company_id` forced to
  caller's company.
- Onboarding wizard — sends only descriptive fields to the RPC; the Step-6 role
  selector sets the *invitation* role (server-revalidated), no client privilege.
- Company creation open to any authed user (0001:116) — self-serve by design; the
  creator becomes admin of their OWN new company. Not a finding.

## Secondary (on record, not fixed)

**§3.1 — a `role`/`company_id` self-escalation emits no audit event.**
`emit_member_joined_event` (0008:160) fires only on `status → active`, not on
role/company change. Once 0090 blocks the escalation this is moot for the attack,
but a privileged-column-change event is worth adding for defence-in-depth. Logged,
not built (no current writer path after 0090).

## Inspected vs not inspected

**Inspected:** 0001 (profiles + all RLS), 0008 (invitations + accept + profiles
policies), 0011, 0034 (is_support_agent), 0045 (bootstrap triggers), 0046/0047
(onboarding RPC), 0072 (sales_coach_role), 0089; `onboarding/page.tsx`,
`api/team/route.ts`, `api/team/accept/route.ts`, `careAgentAuth.ts`,
`vendorAuth.ts`, `auth-helpers.ts`, `sales-coach/layout.tsx`,
`care/agent/settings/agents/route.ts`, `coach/sales-session/team/route.ts`.
Grepped all migrations for profiles `WITH CHECK` / `REVOKE` / guard triggers (none
pre-0090) and all `src` writers of the four columns.

**Not inspected:** `/api/admin/crm/*` route bodies (only their shared
`requireVendorAdmin` choke point — unchanged by this); Supabase Auth signup/login
(role untouched there). Neither changes the conclusion.

**One operational confirm for the founder:** that the deployed `profiles` UPDATE
policy matches 0001 (no out-of-band dashboard `WITH CHECK`/`REVOKE`). A `\d+
profiles` / policy dump confirms in seconds. Then **apply 0090** — the hole is open
until it lands, alongside the still-pending 0085–0089.

Gate green: typecheck 0, lint 0, 389 tests pass.
