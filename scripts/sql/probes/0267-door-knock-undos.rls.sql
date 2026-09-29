-- scripts/sql/probes/0267-door-knock-undos.rls.sql
--
-- 0267's insert policy exercised AS A REP, under RLS, on a fresh database — the §2.2 drift guard for the
-- rule that also lives in undoKnock (UNDO_WINDOW_MS). Each term is run both ways: in-window / 2 h old,
-- own knock / another rep's, own company / foreign.
--
-- Run (Docker; the same image CI uses):
--   docker run -d --name rls-probe -e POSTGRES_PASSWORD=postgres postgres:16-alpine
--   docker exec -i rls-probe psql -U postgres -q -v ON_ERROR_STOP=1 < scripts/sql/supabase-shim.sql
--   for m in supabase/migrations/*.sql; do docker exec -i rls-probe psql -U postgres -q < "$m"; done
--   docker exec -i rls-probe psql -U postgres -q < scripts/sql/probes/0267-door-knock-undos.rls.sql
--   docker rm -f rls-probe
--
-- Expected (2026-09-29): fixture 2 · result 1 = 1 · cases 2-4 "violates row-level security policy" ·
-- result 6 live=2 raw=3 · final undo rows = 1. If result 1 is 0, the FIXTURE is broken, not the policy:
-- when every case is refused the probe proves nothing.
-- 0267's insert policy, exercised AS A REP under RLS — both branches of every term (§2.2 drift guard).
\set ON_ERROR_STOP 0
\pset tuples_only on

-- Fixtures, as superuser. Rep A and rep B in company C1.
insert into companies(id, name) values ('c1c1c1c1-0000-0000-0000-000000000001', 'Probe Co');
insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000aa'), ('00000000-0000-0000-0000-0000000000bb');
insert into profiles(id, company_id) values
  ('00000000-0000-0000-0000-0000000000aa', 'c1c1c1c1-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000bb', 'c1c1c1c1-0000-0000-0000-000000000001')
-- The new-user trigger (0011 handle_new_user) already created both profiles with NO company. Set it.
on conflict (id) do update set company_id = excluded.company_id;
select 'fixture: reps with a company = ' || count(*) from profiles where company_id = 'c1c1c1c1-0000-0000-0000-000000000001';
insert into door_knocks(id, company_id, rep_id, outcome, local_date, created_at) values
  ('a0000000-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'sold', current_date, now()),
  ('a0000000-0000-0000-0000-000000000002', 'c1c1c1c1-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'sold', current_date, now() - interval '2 hours'),
  ('a0000000-0000-0000-0000-000000000003', 'c1c1c1c1-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'go_back', current_date, now());
-- Supabase grants table privileges to `authenticated` by default; the shim does not, so grant here —
-- otherwise every insert below would fail on PERMISSION, not on POLICY, and the probe would prove nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete on door_knocks, door_knock_undos, profiles to authenticated;
grant select on door_knocks_live to authenticated;

set role authenticated;

\echo '--- 1. rep A undoes own FRESH knock (expect: allowed) ---'
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa';
insert into door_knock_undos(knock_id, company_id, rep_id)
  values ('a0000000-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa');
select 'result 1: undone rows = ' || count(*) from door_knock_undos where knock_id = 'a0000000-0000-0000-0000-000000000001';

\echo '--- 2. rep A undoes own knock from 2 HOURS ago (expect: refused by policy) ---'
insert into door_knock_undos(knock_id, company_id, rep_id)
  values ('a0000000-0000-0000-0000-000000000002', 'c1c1c1c1-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa');

\echo '--- 3. rep B undoes REP A''s fresh knock (expect: refused by policy) ---'
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000bb';
insert into door_knock_undos(knock_id, company_id, rep_id)
  values ('a0000000-0000-0000-0000-000000000003', 'c1c1c1c1-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000bb');

\echo '--- 4. rep A, own fresh knock, but a FOREIGN company id (expect: refused by policy) ---'
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa';
insert into door_knock_undos(knock_id, company_id, rep_id)
  values ('a0000000-0000-0000-0000-000000000003', 'c2c2c2c2-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa');

\echo '--- 5. rep A tries to EDIT and DELETE an undo (expect: 0 rows each — no policy) ---'
update door_knock_undos set undone_at = now() where knock_id = 'a0000000-0000-0000-0000-000000000001';
delete from door_knock_undos where knock_id = 'a0000000-0000-0000-0000-000000000001';

\echo '--- 6. what rep A now counts (expect: 2 live of 3 raw — only knock 1 was undone) ---'
select 'result 6: live=' || (select count(*) from door_knocks_live) || ' raw=' || (select count(*) from door_knocks);

reset role;
select 'final undo rows (superuser view) = ' || count(*) from door_knock_undos;
