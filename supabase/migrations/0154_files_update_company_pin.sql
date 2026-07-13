-- 0154 — Security fix: files_update must PIN the new row's company_id (write-side tenant isolation).
--
-- Bug (found by a §1.3 outside-view sweep of every UPDATE/ALL policy that omits an explicit WITH CHECK):
-- `files_update` (0057) is declared as
--
--     for update using ( uploader_id = auth.uid() or exists(<admin in same company>) )
--
-- with NO explicit `with check`. Postgres then reuses the USING expression as the WITH CHECK on the NEW
-- row — and the `uploader_id = auth.uid()` branch is satisfied REGARDLESS of company_id. So an uploader
-- could issue a direct PostgREST call:
--
--     update files set company_id = '<another-company-uuid>' where id = '<their own file>';
--
-- …and it would be permitted: the OLD row passes USING (they're the uploader) and the NEW row passes the
-- implicit check (they're still the uploader). Nothing else stops it — the 0056 triggers only recompute
-- classification; unlike `profiles` (guarded by the 0090 role/company freeze), `files.company_id` is not
-- frozen. The file's metadata row lands in another tenant's namespace.
--
-- Severity: LOW, and deliberately stated as such rather than inflated:
--   • It requires knowing the target company's UUID, which the product does not expose.
--   • It moves METADATA only. The storage object stays under the original company's path and downloads are
--     IDOR-scoped separately, so the target sees a dangling row, never the file's contents.
--   • `files_select` (0057:35) leads with a hard AND-ed cross-tenant gate — "never see another company's
--     files regardless of access_role" — so there is NO read-escape and NO content leak anywhere here.
--   • It is self-defeating: the attacker loses access to their own file.
-- It is still a genuine breach of write-side tenant isolation, and the fix is one policy.
--
-- Fix: declare the WITH CHECK explicitly and pin the NEW row to the caller's company. The uploader/admin
-- condition is RE-ASSERTED inside the check (not just the company pin) because an explicit WITH CHECK
-- REPLACES the implicit one — omitting it would newly permit reassigning `uploader_id` to someone else.
-- So the new row must satisfy BOTH: it stays in your company, AND you are still its uploader or a
-- same-company admin. Legitimate flows are unchanged: an uploader editing/soft-deleting their own file
-- (deprecated_at, description, access_role) leaves company_id untouched, so `company_id = auth_company_id()`
-- holds and the update proceeds exactly as before.
--
-- Idempotent (drop policy if exists + create). No data change. Scope: the `files_update` policy only.
--
-- NOT verified against a live DB by the agent (no DB access) — apply, then smoke-test the two legitimate
-- paths: (1) an uploader can still edit + soft-delete (deprecated_at) their own file; (2) a CEO/COO/admin
-- can still edit a file in their own company. Both must still work; a cross-company company_id move must fail.

drop policy if exists files_update on files;
create policy files_update on files
  for update
  using (
    uploader_id = auth.uid()
    or exists (
      select 1 from profiles
      where id = auth.uid()
        and company_id = files.company_id
        and role in ('CEO', 'COO', 'admin')
    )
  )
  with check (
    -- Tenant pin on the NEW row: you may edit your file, you may NOT move it to another company.
    company_id = auth_company_id()
    and (
      uploader_id = auth.uid()
      or exists (
        select 1 from profiles
        where id = auth.uid()
          and company_id = files.company_id
          and role in ('CEO', 'COO', 'admin')
      )
    )
  );
