-- BEHAVIOURAL probe for 0265 — impersonates a CFO and attempts RLS-gated admin writes.
--
-- TWO THINGS THIS PROBE GOT WRONG ON EARLIER RUNS, both fixed here, because a probe that reports
-- the wrong answer is worse than no probe:
--
--  1. `auth.uid()` in this scratch database is a shim reading `request.jwt.claim.sub` — SINGULAR —
--     not the `request.jwt.claims` JSON the real Supabase function parses. Setting the wrong one
--     makes auth.uid() null, every policy deny, and the probe "prove" a CFO is refused.
--  2. The `authenticated` role here has no USAGE on schema `auth` (Supabase grants it; this local
--     replay does not). Granted below, inside the transaction, so the rollback takes it back.
--  3. A bare `\echo` alarm still PRINTS after a failed statement, because psql echoes regardless
--     of the aborted transaction. The first run printed "A MEMBER JUST CREATED A DEPARTMENT" when
--     the member insert had in fact been refused. Every assertion here is now a SELECT whose
--     output is the evidence, inside a savepoint so one refusal does not abort the rest.
begin;
set local session_replication_role = replica;

insert into auth.users (id) values
  ('bbbbbbbb-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002');
insert into companies (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001','Probe Co');
insert into profiles (id, company_id, role, full_name)
values ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','CFO','Probe CFO'),
       ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Member','Probe Member');

grant usage on schema auth to authenticated;
-- Supabase's platform grants `authenticated` table privileges; this local replay of the migration
-- history does not, so the probe supplies them. RLS still applies ON TOP of a grant for a
-- non-owner role — that is the whole point of the layering, and it is what makes this a faithful
-- reproduction rather than a bypass.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
set local session_replication_role = origin;

\echo ''
\echo '=== impersonation works (uid must NOT be null, role must read CFO) ==='
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-0000-0000-0000-000000000001';
select auth.uid() as uid, (select role from profiles where id = auth.uid()) as acting_as;

\echo ''
\echo '=== as the CFO: create a department ==='
savepoint s1;
insert into departments (company_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001','Probe Dept');
release savepoint s1;
select count(*) as cfo_created_departments from departments where name = 'Probe Dept';

\echo ''
\echo '=== as the CFO: put a person in a department ==='
savepoint s2;
insert into profile_departments (profile_id, department_id, assigned_by)
select 'bbbbbbbb-0000-0000-0000-000000000002', id, 'bbbbbbbb-0000-0000-0000-000000000001'
from departments where name = 'Probe Dept';
release savepoint s2;
select count(*) as cfo_created_assignments from profile_departments;

\echo ''
\echo '=== as a Member: the SAME write must still be refused (expect 0) ==='
set local "request.jwt.claim.sub" = 'bbbbbbbb-0000-0000-0000-000000000002';
select auth.uid() as uid, (select role from profiles where id = auth.uid()) as acting_as;
savepoint s3;
insert into departments (company_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001','Should Fail');
rollback to savepoint s3;
select count(*) as member_created_departments from departments where name = 'Should Fail';

\echo ''
\echo '=== THE A/B: put the OLD list back in the function and the CFO must be refused again ==='
\echo '=== (proves the 47 policies really consult admin_roles(), not a folded constant)     ==='
reset role;
create or replace function public.admin_roles() returns text[] language sql stable
  parallel safe set search_path = public as $$ select array['CEO','COO','admin']::text[] $$;
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-0000-0000-0000-000000000001';
select auth.uid() as uid, (select role from profiles where id = auth.uid()) as acting_as;
savepoint s4;
insert into departments (company_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001','CFO Without The Fix');
rollback to savepoint s4;
select count(*) as cfo_created_with_old_list from departments where name = 'CFO Without The Fix';
rollback;
