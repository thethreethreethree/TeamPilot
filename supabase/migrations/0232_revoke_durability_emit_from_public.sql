-- 0232 — complete the 0231 revoke: functions default to GRANT EXECUTE TO PUBLIC, so revoking from
--        `authenticated`/`anon` alone is a NO-OP (they inherit EXECUTE via PUBLIC). Revoke PUBLIC too — and
--        re-grant service_role explicitly so the durability-sweep CRON (createAdminClient → service_role) keeps
--        working. Verified live after 0231 that has_function_privilege('authenticated', ...) was STILL true.
--
-- (This is the Supabase revoke-from-role-is-a-no-op-without-PUBLIC trap; the fix is to revoke PUBLIC + the
-- roles, then affirmatively grant only the role that must retain it.)

revoke execute on function emit_care_durability_due_event(uuid) from public, authenticated, anon;
grant  execute on function emit_care_durability_due_event(uuid) to service_role;
