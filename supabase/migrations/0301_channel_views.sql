-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0301 — which module a score and a point belong to (founder 2026-11-22: Remote Sales completely separate from Sales
--        Coach, with its own scoreboard and points; Sales Coach counts in-person only)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- Sales Coach's dashboards, leaderboard, points and board read pitch_scores and agent_point_ledger with no channel
-- filter, so scored phone/video calls would count in Sales Coach. The channel of a score or a point is the channel of
-- its session: coaching_sessions.context ('in_person' | 'video' | 'phone'). A door pitch with no session is in person.
--
-- WHY VIEWS, NOT A COLUMN: agent_point_ledger refuses every UPDATE (agent_point_ledger_no_mutate, 0242), so a stored
-- channel could not be backfilled onto existing rows; a derived channel needs no backfill and cannot drift from the
-- session it comes from. THE RULE IS HERE ONCE: coalesce(session.context, 'in_person'). Readers filter
-- `channel = 'in_person'` (Sales Coach) or `channel in ('phone','video')` (Remote Sales) — the TS twin is
-- contextsOf(module) in src/lib/coach/sessionContext.ts.
--
-- security_invoker: the caller's RLS on pitch_scores / agent_point_ledger (and the 0273 reporting tree) still decides
-- what is visible; the join to coaching_sessions only reads the context of rows the caller can already see. Writes
-- stay on the tables. Idempotent (A12).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

create or replace view public.pitch_scores_by_channel
with (security_invoker = true) as
select p.*, coalesce(s.context, 'in_person') as channel
from public.pitch_scores p
left join public.coaching_sessions s on s.id = p.session_id;
grant select on public.pitch_scores_by_channel to authenticated, service_role;

create or replace view public.agent_point_ledger_by_channel
with (security_invoker = true) as
select l.*, coalesce(s.context, 'in_person') as channel
from public.agent_point_ledger l
left join public.coaching_sessions s on s.id = l.session_id;
grant select on public.agent_point_ledger_by_channel to authenticated, service_role;
