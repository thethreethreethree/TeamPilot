-- 0225 — drop the stale 3-arg apply_schedule_import overload (found by live-schema verification of 0223).
--
-- 0223 added p_cancel_shift_ids via `create or replace function apply_schedule_import(... , p_cancel_shift_ids
-- uuid[] default '{}')`. Because the argument LIST changed, Postgres created a SECOND function rather than
-- replacing the 0222 one — so BOTH overloads went live: the old 3-arg and the new 4-arg. With the 4-arg's
-- defaulted last parameter, a 3-arg call now matches BOTH candidates and raises
-- `function apply_schedule_import(text[], jsonb, jsonb) is not unique` (verified against the live DB).
--
-- The 4-arg version (with `p_cancel_shift_ids default '{}'`) subsumes the 3-arg one — a caller that passes no
-- cancel ids gets identical behavior. So drop the stale 3-arg overload; the single remaining 4-arg function
-- resolves a 3-arg call unambiguously via its default. This also makes the commitImport guarded fallback
-- (a 3-arg call for the pre-0223 window) resolve cleanly instead of hitting the ambiguity.

drop function if exists apply_schedule_import(text[], jsonb, jsonb);
