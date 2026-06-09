-- Conversational Coach v1.1 — company-level toggle.
--
-- User intent: the Coach should be available across every
-- communication surface (chat, tasks, decisions, feedback, smoke test
-- notes) rather than per-topic only. Per-topic toggling stays (it's
-- the finer-grained override), but the master switch lives on the
-- company.
--
-- Default OFF (asset A3 — anti-game-your-own-evaluation defaults).
-- Companies created before this migration backfill to false so the
-- §4 readout has a clean before/after baseline for any company that
-- later flips it on.
--
-- Semantics when both flags exist:
--   - companies.coach_enabled = true  → Coach active on every
--     communication surface (tasks, decisions, feedback, smoke test
--     notes). Chat surfaces also active regardless of per-topic flag.
--   - companies.coach_enabled = false → only chat topics with
--     coach_enabled = true get the Coach (existing v1 behavior).
--
-- The §4 readout buckets coach events by SURFACE (chat / task / etc.)
-- so when a company flips the company-level flag, the before/after
-- comparison shows per-surface impact.

alter table companies
  add column if not exists coach_enabled boolean not null default false;

comment on column companies.coach_enabled is
  'When true, the Conversational Coach activates across all communication surfaces (tasks, decisions, feedback, smoke test notes, chat). Per-topic chat coach_enabled is the finer-grained override. Default OFF per asset A3 so the §4 readout has a clean baseline.';
