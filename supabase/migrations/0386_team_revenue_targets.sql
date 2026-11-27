-- 0386 — team revenue targets (2026-11-27; revenue plan phase 7; Gong F23.4; founder picker 2026-11-27 "Team revenue
-- targets only"). Re-runnable.
--
-- forecast_targets (0376) held one quarterly revenue target per person. A row can now be a TEAM's target: for_team =
-- true and user_id = the manager whose team it is (their reporting tree). The latest per (user, quarter, for_team)
-- wins, as before. 0376's insert policy already decides who may set it (an admin or Sales Coach manager, for themselves
-- or a rep the tree allows), so a manager sets their own team's target and an admin any manager's. Revenue only: no
-- targets on other metrics (the "no metric builder" decision stands). Append-only (0376's rules).

alter table public.forecast_targets add column if not exists for_team boolean not null default false;
drop index if exists forecast_targets_idx;
create index if not exists forecast_targets_idx on public.forecast_targets (company_id, period, user_id, for_team, id desc);
