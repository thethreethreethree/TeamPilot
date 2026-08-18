-- 0217_rep_kpi_daily_invoker_literal.sql
--
-- Follow-up to 0216: the rep_kpi_daily view IS security_invoker in the live DB (0216 set it, and
-- verify:live's behavioural check passed), but 0216 used `= on` while the repo convention + the
-- rls:audit static check require the literal `security_invoker = true`. This restates it with the
-- canonical literal so the static auditor recognises the view as safe (last-statement-wins). No
-- behavioural change (`on` ≡ `true` in Postgres). Forward-only; 0215/0216 are applied and untouched.
alter view rep_kpi_daily set (security_invoker = true);
