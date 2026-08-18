-- 0219_macro_mode_toggle.sql
--
-- Per-rep Macro Mode toggle (founder decision 2026-08-18: per-rep, alongside the normal Sales Coach).
-- A rep flips this for themselves; when on, the Door Log + Report Card nav entries appear. A boolean on
-- profiles, self-updatable via the existing "own profile - update" policy (0001:110). It is NOT a
-- privileged column (0090 guards role/company_id/sales_coach_role/status against self-escalation; a
-- feature-visibility flag a rep sets on their OWN row is not an authorization boundary), so no policy
-- change is needed. Forward-only, idempotent.
alter table profiles add column if not exists macro_mode_enabled boolean not null default false;
