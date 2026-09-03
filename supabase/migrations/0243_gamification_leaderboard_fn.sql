-- 0243 — Gamification Phase 5: the leaderboard aggregate function.
--
-- The board shows RANK + TOTALS + DEALS to the whole team (founder decision: gamify within privacy), but per-session
-- score DETAIL stays rep-private (the ledger rows are owner+manager RLS, 0242). So the board must NOT read the
-- ledger rows directly — it reads THIS function, which returns ONLY per-agent aggregates (no per-session rows),
-- company-scoped to the caller. One query, aggregated in the DB (never N-per-agent or fetch-all-and-sum-in-JS).
--
-- SECURITY DEFINER + pinned search_path: it runs as definer to read across the company's ledger, but auth.uid()
-- (and thus auth_company_id()) is still the CALLER, so it returns only the caller's company — and only aggregates.
-- Granted to authenticated so every company member can see the board (rank+totals are the public layer).

create or replace function gamification_leaderboard(p_period text default 'all')
returns table (
  agent_id     uuid,
  full_name    text,
  sessions     int,
  total_points bigint,
  avg_points   numeric,
  best_points  int,
  deals        int
) language sql security definer set search_path = public stable as $$
  with co as (select auth_company_id() as cid),
  since as (
    select case lower(coalesce(p_period, 'all'))
      when 'week'  then date_trunc('week',  now())
      when 'month' then date_trunc('month', now())
      else '-infinity'::timestamptz
    end as ts
  ),
  pts as (
    -- SUM over the ledger is the truth (never a cached counter). session_score rows drive session/avg/best;
    -- corrections (negative rows) still count toward the running TOTAL, so a corrected total stays honest.
    select l.agent_id,
           count(*) filter (where l.reason = 'session_score')                as sessions,
           sum(l.points)                                                     as total_points,
           round(avg(l.points) filter (where l.reason = 'session_score'), 1) as avg_points,
           max(l.points)       filter (where l.reason = 'session_score')     as best_points
    from agent_point_ledger l, co, since
    where l.company_id = (select cid from co) and l.created_at >= (select ts from since)
    group by l.agent_id
  ),
  dealcount as (
    select s.agent_id, count(*)::int as deals
    from coaching_sessions s, co, since
    where s.company_id = (select cid from co)
      and s.outcome = 'sold'                       -- the LIVE closed-deal value (FINDINGS: 0205 'won' was a no-op)
      and s.started_at >= (select ts from since)
    group by s.agent_id
  )
  select p.agent_id,
         pr.full_name,
         coalesce(p.sessions, 0)::int,
         coalesce(p.total_points, 0)::bigint,
         coalesce(p.avg_points, 0)::numeric,
         coalesce(p.best_points, 0)::int,
         coalesce(d.deals, 0)::int
  from pts p
  left join dealcount d on d.agent_id = p.agent_id
  left join profiles  pr on pr.id = p.agent_id
  -- D4: points primary; ties → higher average, then fewer sessions (so volume alone doesn't win).
  order by coalesce(p.total_points, 0) desc, coalesce(p.avg_points, 0) desc, coalesce(p.sessions, 0) asc;
$$;

grant execute on function gamification_leaderboard(text) to authenticated;
