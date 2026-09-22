-- Behavioural probe for 0265, to run against the scratch DB after applying it.
-- Proves the function is what the policies consult, and that the CFO gains admin while nothing
-- else changes. Rolled back.
begin;
\echo '=== the list, as the policies now see it ==='
select admin_roles();

\echo '=== every policy that used the literal now calls the function (expect 0 literals, 47 policies) ==='
select
  count(*) filter (where (coalesce(qual,'')||coalesce(with_check,'')) like '%admin_roles()%') as calls_fn,
  count(*) filter (where (coalesce(qual,'')||coalesce(with_check,'')) like '%ARRAY[''CEO''::text, ''COO''::text, ''admin''::text]%') as still_literal
from pg_policies where schemaname='public';

\echo '=== total policy count unchanged (expect 322) ==='
select count(*) from pg_policies where schemaname='public';

\echo '=== the four roles are admin; everything else is not ==='
select r as role, r = any(admin_roles()) as is_admin
from unnest(array['CEO','CFO','COO','admin','VP','Director','Manager','Member','member',null]) as r;
rollback;
