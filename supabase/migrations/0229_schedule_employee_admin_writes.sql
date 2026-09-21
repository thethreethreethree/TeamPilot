-- A12 RE-RUNNABILITY GUARDS ADDED 2026-09-21. The statements below this line are the original
-- migration; the only change is that object creations are now guarded (drop-if-exists before
-- create policy/trigger, existence checks around create type, if-not-exists on indexes,
-- drop-before-create on views). NOTHING about the resulting schema changed — verified by
-- applying all 254 migrations twice against Postgres 16: 0 failures on a fresh database.
--
-- WHY AN APPLIED MIGRATION WAS EDITED. A12 (0021 and 0022 both failed live on "already
-- exists") requires migrations to be safe-to-re-run BY CONSTRUCTION. 18 of these were not, and
-- a later migration cannot fix an earlier one — on any replay 0001 still runs first. Tested:
-- a repair migration leaves 0001 failing exactly as before. Editing in place is the only thing
-- that reaches zero. Supabase never re-runs an applied migration, so production is untouched.
-- Founder decision, 2026-09-21. Record: docs/tbc/2026-09-21-migration-idempotency/.

-- 0229 — restrict schedule_employee WRITES to managers (A26 sweep of the 0226/0227 route-only-admin class).
--
-- Finding (live probe): schedule_employee had a single `for all` RLS policy scoped only by company
-- (`company_id = auth_company_id()`), so a non-admin member could INSERT / UPDATE / DELETE roster rows via a
-- direct PostgREST call — add fake staff, rename, deactivate colleagues, even DELETE staff — bypassing the
-- roster routes' isAdmin gate. Same route-gated-but-RLS-open class the founder chose to DB-enforce for the
-- settings PATCH (0226) and the schedule write RPCs (0227). Roster management is a manager task; the routes
-- already gate isAdmin, so this makes the DB enforce the same (within-tenant; not cross-tenant).
--
-- Split the single ALL policy into: members READ the roster (needed for the grid / scheduling views), and only
-- CEO/COO/admin WRITE it. Reuses auth_is_schedule_manager(company_id) (0227/0228) — which itself guards
-- `p_company = auth_company_id()` — so a write is allowed only for the caller's OWN company AND an admin role.
-- Service-role / table-owner contexts bypass RLS (seeds, the apply_schedule_import RPC when an admin runs it).

drop policy if exists "schedule_employee tenant" on schedule_employee;

drop policy if exists "schedule_employee read" on schedule_employee;
create policy "schedule_employee read" on schedule_employee
  for select using (company_id = auth_company_id());

drop policy if exists "schedule_employee admin insert" on schedule_employee;
create policy "schedule_employee admin insert" on schedule_employee
  for insert with check (auth_is_schedule_manager(company_id));

drop policy if exists "schedule_employee admin update" on schedule_employee;
create policy "schedule_employee admin update" on schedule_employee
  for update using (auth_is_schedule_manager(company_id))
  with check (auth_is_schedule_manager(company_id));

drop policy if exists "schedule_employee admin delete" on schedule_employee;
create policy "schedule_employee admin delete" on schedule_employee
  for delete using (auth_is_schedule_manager(company_id));
