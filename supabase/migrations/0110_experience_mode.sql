-- 0110 — Experience Mode (Standard / Expert): the per-user complexity dial.
--
-- Why
-- ───
-- Consistent partner feedback: the system is overwhelming — information overload /
-- paralysis for Customer + Sales agents (§1.1 data-as-asset: a repeated signal is a
-- pattern). The fix is NOT two parallel apps (double maintenance + drift); it is ONE
-- system with a per-USER experience level that drives (a) AI-output verbosity/depth
-- and (b) UI progressive disclosure. Mirrors the existing Learning Mode preference
-- (profiles.learning_mode_enabled, 0051) — same per-user, persisted, RLS-scoped,
-- non-privileged shape (§A28: build on the precedent already in the tree).
--
-- Design decisions (founder-confirmed 2026-07-09):
--   • Per-user (each agent picks their own), not per-company — overload is per-person.
--   • Default 'standard' for NEW users (who are overwhelmed); EXISTING users start on
--     'expert' so today's behavior is unchanged for current power users.
--   • Standard is a FLOOR, not a ceiling — the UI always keeps a one-click "show full
--     reasoning" (enforced in components); Standard never HIDES truth, it reduces what's
--     shown at once (§3.3/§3.4 — honesty + capability-transfer preserved).
--
-- Idempotent-safe backfill WITHOUT an UPDATE (the important bit): add the column
-- defaulting to 'expert' so every EXISTING row is backfilled to today's experience in
-- one shot, THEN flip the default to 'standard' for FUTURE rows. A naive
-- `update ... set 'expert' where mode='standard'` would, on any re-run, wrongly flip a
-- legitimately-Standard NEW user back to Expert — this two-step avoids that entirely and
-- is a clean no-op on re-run. §A12.

-- Step 1 — add with default 'expert': existing profiles inherit 'expert' immediately.
alter table profiles
  add column if not exists experience_mode text not null default 'expert'
    check (experience_mode in ('standard', 'expert'));

-- Step 2 — future rows default to 'standard' (new users start simplified).
alter table profiles
  alter column experience_mode set default 'standard';
