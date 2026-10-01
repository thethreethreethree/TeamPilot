-- scripts/sql/probes/0267-door-knock-undos.rls.sql
--
-- 0267's insert policy exercised AS A REP, under RLS, on a fresh database — the §2.2 drift guard for the
-- rule that also lives in undoKnock (UNDO_WINDOW_MS). Each term is run both ways: in-window / 2 h old,
-- own knock / another rep's, own company / foreign.
--
-- CI runs this automatically: scripts/migration-apply-audit.mjs PASS 3 applies every migration to a fresh
-- postgres:16-alpine, runs each probe on its own copy, and fails on the assertion block at the end.
--
-- By hand (Docker; the same image CI uses):
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

-- ASSERTIONS (added 2026-10-01, so this probe is a GATE, not a printout someone has to read).
-- The refusals above are expected, so errors were non-fatal until here. From here any mismatch stops psql
-- with a non-zero exit, and scripts/migration-apply-audit.mjs (PASS 3) fails CI on it.
\set ON_ERROR_STOP 1
do $assert$
declare
  reps int; undos int; undo1 int; undo2 int; undo3 int; raw int; live int;
begin
  select count(*) into reps from profiles where company_id = 'c1c1c1c1-0000-0000-0000-000000000001';
  if reps <> 2 then raise exception 'FIXTURE BROKEN: % reps in the probe company, expected 2 (every case below would prove nothing)', reps; end if;
  select count(*) into undos from door_knock_undos;
  select count(*) into undo1 from door_knock_undos where knock_id = 'a0000000-0000-0000-0000-000000000001';
  select count(*) into undo2 from door_knock_undos where knock_id = 'a0000000-0000-0000-0000-000000000002';
  select count(*) into undo3 from door_knock_undos where knock_id = 'a0000000-0000-0000-0000-000000000003';
  if undo1 <> 1 then raise exception 'case 1/5: a rep could not undo their own fresh knock, or the undo was edited away (undo rows for knock 1 = %)', undo1; end if;
  if undo2 <> 0 then raise exception 'case 2: a 2-hour-old knock was undone; the 60-minute window is not enforced'; end if;
  if undo3 <> 0 then raise exception 'case 3/4: another rep''s knock, or a knock under a foreign company id, was undone'; end if;
  if undos <> 1 then raise exception 'expected exactly 1 undo row, found %', undos; end if;
  select count(*) into raw from door_knocks;
  select count(*) into live from door_knocks_live;
  if raw <> 3 or live <> 2 then raise exception 'case 6: expected raw=3 live=2, got raw=% live=%', raw, live; end if;
  raise notice 'probe 0267: all assertions hold';
end
$assert$;
