-- 0216_rep_kpi_daily_security_invoker.sql
--
-- Fix (verify:live caught it, 2026-08-18): the rep_kpi_daily view from 0215 was created WITHOUT
-- security_invoker, so it runs with the view owner's privileges and BYPASSES the door_knocks RLS —
-- any authenticated user could read every company's KPI aggregates. Setting security_invoker = on
-- makes the view run as the QUERYING user, so the door_knocks rep+manager RLS applies through it.
-- Forward-only (0215 is applied; never edit an applied migration). Idempotent.
alter view rep_kpi_daily set (security_invoker = on);
