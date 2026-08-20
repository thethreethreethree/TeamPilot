-- 0234 — Schedule Management System: custom schedule name (§1.5.4 founder request, 2026-08-20).
--
-- The printed/downloaded schedule titled itself with the company name (e.g. "Elostate — Schedule"). The founder
-- asked to set a CUSTOM name for the schedule so the export title isn't forced to the company name ("The Default
-- name for the schedule is Elostate, could you make it so that the System can add a custom name").
--
-- Additive + nullable, so existing rows keep today's behavior: NULL means "fall back to the company name" (the
-- reading code, getScheduleSettings, coerces NULL/blank → null and the export uses the company name). Mirrors
-- the 0224 timezone/workweek_start pattern, and the reading code keeps a guarded fallback so it is correct
-- whether or not this migration has been applied (never asserts "migration applied").

alter table companies
  add column if not exists schedule_name text
    check (schedule_name is null or char_length(schedule_name) <= 60);

comment on column companies.schedule_name is
  'Custom title for the printed/downloaded schedule. NULL = use the company name. Schedule Management System (0234).';
