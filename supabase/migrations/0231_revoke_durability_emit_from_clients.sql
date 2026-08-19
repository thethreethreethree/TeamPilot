-- 0231 — revoke emit_care_durability_due_event from clients (care/sales-coach sweep, founder-authorized 2026-08-20).
--
-- Finding (live probe of the care module): emit_care_durability_due_event(p_check_id uuid) is SECURITY DEFINER
-- and EXECUTE-granted to `authenticated`, but it reads support_durability_checks by id WITHOUT tenant-checking
-- it (a definer bypasses RLS) and then writes an `events` row with the referenced conversation's company_id.
-- So a member could call it via PostgREST with ANOTHER tenant's check_id to emit a spurious
-- 'care.conversation.durability_due' event into that tenant's log. LOW severity — the event is an idempotent
-- signal (it returns early if already emitted or the check is done), no data is read back to the caller, no
-- privilege is gained — but it is a cross-tenant WRITE via an unguarded definer parameter. (invariant-audit
-- INVARIANT 4 did not catch it because the parameter is a check_id, not a company id.)
--
-- The function is ONLY ever called by the durability-sweep CRON, which runs as SERVICE-ROLE (createAdminClient
-- in src/lib/care/durabilitySweep.ts; routes /api/care/durability-sweep{,-cron}). No client path calls it as an
-- authenticated user. So the fix is to REVOKE the client grant (remove the attack surface — the invariant-audit
-- preferred remedy) rather than guard the parameter; service-role retains EXECUTE, so the cron is unaffected.

revoke execute on function emit_care_durability_due_event(uuid) from authenticated, anon;
