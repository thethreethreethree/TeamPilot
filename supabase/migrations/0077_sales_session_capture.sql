-- 0077_sales_session_capture.sql
-- Sessions Phase 2 — the capture layer.
--
-- Each coaching session records the WHERE / HOW / WHAT of the call (entered
-- at start) and the OUTCOME (the downstream result, recorded after). WHEN is
-- already captured as started_at (0070); WHY is derived by the Phase 3
-- engine, not captured here.
--
-- §3.5: the OUTCOME is the consequence the differentiated metric must anchor
-- to. It is stored two ways, deliberately: as a column (the derived current
-- state, for display + filtering) AND — by the app, not this migration — as
-- an append-only `coach.session_outcome_recorded` event (§3.1: the immutable
-- record the WHY engine replays). The column is a convenience projection of
-- the last such event, never the source of truth for history.
--
-- All fields nullable: only the session TITLE was made required (founder
-- 2026-07-01). Capture is opt-in, never a gate on starting or ending a call.

alter table coaching_sessions
  add column if not exists territory text,   -- WHERE (manual / free text)
  add column if not exists approach  text,   -- HOW   (how the call was engaged)
  add column if not exists offer     text;   -- WHAT  (the offer / product pitched)

-- OUTCOME as a constrained enum. Values are intentionally a small, revisable
-- set (founder may extend — a later migration can widen the check without
-- data loss). no_contact = door not answered / prospect unreachable.
alter table coaching_sessions
  add column if not exists outcome text
    check (outcome in ('sold', 'follow_up', 'no_sale', 'no_contact', 'undecided'));
