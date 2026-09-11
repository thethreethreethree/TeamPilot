-- 0250 — close a cross-tenant WRITE hole in rep_daily_sales_goal (door home screen goals).
--
-- FINDING (2026-09-12 audit, triggered by the cross-company metric leak class in F34/F35 / 0a157677):
-- the 0247 INSERT policy checks the NEW row's company_id = auth_company_id() and that the caller is a manager in
-- that company — but it NEVER checks that rep_id belongs to that company. rep_id only FKs to global auth.users, so
-- a manager in company A who knows a rep's UUID in company B could INSERT a daily sales goal (+ $-per-sale) for
-- that foreign rep, stamped company A. The rep-self SELECT clause (rep_id = auth.uid()) then surfaces that injected
-- goal to rep B regardless of the row's company_id. UPDATE was already safe (its USING pins the existing row's
-- company); rep_day_target was already safe (rep-self insert only). This is INSERT-only, for a rep with no goal row.
--
-- FIX: add a predicate to the INSERT and UPDATE WITH CHECK requiring the TARGET rep to be a profile in the caller's
-- company. Everything else is copied verbatim from 0247 so the only change is the added rep-in-company clause.
-- Additive + idempotent (drop/create). No data change. Apply via `npm run db:apply` (never hand-apply).

drop policy if exists "rep_daily_sales_goal - manager insert" on rep_daily_sales_goal;
create policy "rep_daily_sales_goal - manager insert" on rep_daily_sales_goal for insert with check (
  company_id = auth_company_id()
  and exists (select 1 from profiles p where p.id = auth.uid()
       and p.company_id = rep_daily_sales_goal.company_id
       and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
  -- NEW: the target rep must belong to the caller's company — blocks a manager stamping a goal onto a foreign rep.
  and exists (select 1 from profiles r where r.id = rep_daily_sales_goal.rep_id
       and r.company_id = auth_company_id())
);

drop policy if exists "rep_daily_sales_goal - manager update" on rep_daily_sales_goal;
create policy "rep_daily_sales_goal - manager update" on rep_daily_sales_goal for update using (
  exists (select 1 from profiles p where p.id = auth.uid()
       and p.company_id = rep_daily_sales_goal.company_id
       and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
) with check (
  company_id = auth_company_id()
  and exists (select 1 from profiles p where p.id = auth.uid()
       and p.company_id = rep_daily_sales_goal.company_id
       and (p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'))
  -- NEW: same guard on update, so a manager can't re-point a row to a foreign rep either.
  and exists (select 1 from profiles r where r.id = rep_daily_sales_goal.rep_id
       and r.company_id = auth_company_id())
);
