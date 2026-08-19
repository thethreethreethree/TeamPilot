-- 0224 — Schedule Management System: company timezone + workweek-start settings (RQ4 / RQ7).
--
-- The schedule's date math defaulted to UTC "today" and an ISO-Monday week. That is wrong for a company in
-- a non-UTC timezone (a shift near midnight lands on the wrong calendar day) or one whose payroll week starts
-- Sunday/Saturday (the weekly-hours cap + the grid week are bucketed on the wrong boundary). The founder chose
-- to make these real company settings (2026-08-19 picker).
--
-- Both columns are additive with safe defaults, so existing rows keep the previous behavior (UTC, Monday):
--   timezone       — an IANA name (e.g. 'America/New_York'); 'UTC' preserves today's behavior.
--   workweek_start — day the workweek/payroll week begins, JS convention 0=Sunday..6=Saturday; 1=Monday
--                    preserves today's ISO-Monday behavior.
--
-- The reading code (getScheduleSettings) keeps a guarded fallback to these same defaults, so the code is
-- correct whether or not this migration has been applied (never asserts "migration applied").

alter table companies
  add column if not exists timezone text not null default 'UTC',
  add column if not exists workweek_start smallint not null default 1
    check (workweek_start between 0 and 6);

comment on column companies.timezone is
  'IANA timezone for schedule date math (what "today" is). Default UTC. Schedule Management System (0224).';
comment on column companies.workweek_start is
  'Day the workweek starts, JS convention 0=Sun..6=Sat. Default 1 (Monday). Weekly-hours cap + grid week (0224).';
