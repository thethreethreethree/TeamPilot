-- 0237_coaching_session_kind.sql
--
-- Meeting Coach (Team-Sync) — the session's COACHING KIND, distinct from its `context`.
-- Founder decision 2026-08-21 (AskUserQuestion): add a `session_kind` column rather than overload the
-- sales-shaped `context` CHECK ('in_person','video'). A meeting is ALSO in-person or video, so "what kind of
-- coaching" (sales | meeting | huddle) is a separate axis from "where the call happens". `session_kind` maps
-- 1:1 to the strategy selector (`CoachingMode` in src/lib/coach/strategy/selectStrategy.ts).
--
-- Additive + idempotent: existing rows default to 'sales' — the pre-Meeting-Coach world was all sales
-- sessions, so no backfill is needed and the sales path is byte-unchanged. Append-only discipline (§3.1) is
-- unaffected: this is a session-classification column set at creation, not a mutable state field.

alter table coaching_sessions
  add column if not exists session_kind text not null default 'sales'
    check (session_kind in ('sales', 'meeting', 'huddle'));

-- Index the new axis alongside company/agent so a per-kind dashboard read (meetings vs sales) is cheap.
create index if not exists coaching_sessions_company_kind_idx
  on coaching_sessions (company_id, session_kind, started_at desc);
