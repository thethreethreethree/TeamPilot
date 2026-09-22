-- Behavioural probe for 0266. Every value production actually holds must be accepted, and a
-- plausible typo must be refused. Rolled back.
begin;
set local session_replication_role = replica;  -- skip the FK to auth.users for the probe only
insert into companies (id, name) values ('cccccccc-0000-0000-0000-000000000001','Probe Co');

\echo ''
\echo '=== every role live in production must still be storable (expect 5 inserts) ==='
insert into profiles (id, company_id, role) values
  ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','admin'),
  ('dddddddd-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000001','Member'),
  ('dddddddd-0000-0000-0000-000000000003','cccccccc-0000-0000-0000-000000000001',null),
  ('dddddddd-0000-0000-0000-000000000004','cccccccc-0000-0000-0000-000000000001','Manager'),
  ('dddddddd-0000-0000-0000-000000000005','cccccccc-0000-0000-0000-000000000001','member');
select count(*) as live_values_accepted from profiles where company_id = 'cccccccc-0000-0000-0000-000000000001';

\echo ''
\echo '=== every role a writer can produce must be storable (the 9 + admin) ==='
savepoint s0;
insert into profiles (id, company_id, role)
select gen_random_uuid(), 'cccccccc-0000-0000-0000-000000000001', r
from unnest(array['CEO','CFO','COO','VP','Director','Manager','Supervisor','Lead','Member','admin']) as r;
release savepoint s0;
select count(*) as reachable_values_accepted from profiles where company_id = 'cccccccc-0000-0000-0000-000000000001';

\echo ''
\echo '=== THE DEFECT: a typo must now be REFUSED (expect 0) ==='
savepoint s1;
insert into profiles (id, company_id, role) values ('eeeeeeee-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','CEo');
rollback to savepoint s1;
select count(*) as typo_accepted from profiles where role = 'CEo';

\echo ''
\echo '=== and an UPDATE to a typo is refused too, not just an insert (expect 0) ==='
savepoint s2;
update profiles set role = 'Adminn' where id = 'dddddddd-0000-0000-0000-000000000001';
rollback to savepoint s2;
select count(*) as typo_updated from profiles where role = 'Adminn';
rollback;
