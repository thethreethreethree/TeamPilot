-- 0233 — gate support_customers WRITES to care agents / admins (care sweep, founder pick 2026-08-20).
--
-- Finding (corrected recon — the first pass missed profiles-subquery scoping): support_customers had
-- company-MEMBERSHIP write policies (any member of the company), while its route (care/agent/customers) uses
-- requireCareAgent (is_support_agent OR CEO/COO/admin). So a plain Member (non-agent, non-admin) could
-- INSERT/UPDATE customer records via direct PostgREST, bypassing the agent gate. Within-tenant, LOW-MED. Same
-- route-gated-but-RLS-open class the founder chose to DB-enforce for the schedule surfaces (0226-0230).
--
-- Fix: replace the write policies with the SAME predicate requireCareAgent + the other care tables (0034/0035)
-- use — a member of the company who is a support agent OR a company admin. SELECT is left as-is (the read is a
-- separate consideration; this closes the WRITE bypass the finding identified). No DELETE policy exists (delete
-- stays denied by default).

drop policy if exists "support_customers - insert" on support_customers;
create policy "support_customers - insert" on support_customers
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_customers.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );

drop policy if exists "support_customers - update" on support_customers;
create policy "support_customers - update" on support_customers
  for update using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_customers.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.company_id = support_customers.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );
