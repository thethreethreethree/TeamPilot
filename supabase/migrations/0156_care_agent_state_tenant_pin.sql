-- 0156 — SECURITY (MED): care_agent_state.company_id must be pinned + frozen.
--
-- This is the most consequential of the write-side tenant-pin findings, because unlike the others it has
-- an ACTIVE cross-tenant effect rather than inert data pollution.
--
-- Bug
-- ───
-- The self-update policy (0095) is:
--
--     for update using (agent_id = auth.uid()) with check (agent_id = auth.uid());
--
-- It pins the AGENT but not the TENANT, and `care_agent_state` carries `company_id uuid not null`. No
-- trigger freezes it either (0042's trg_touch_* only stamps a timestamp; 0045 merely bootstraps the row).
-- So a support agent can run, via direct PostgREST:
--
--     update care_agent_state set company_id = '<another company>', status = 'online'
--     where agent_id = auth.uid();
--
-- …and it is permitted. That matters because CARE routing selects candidate agents BY COMPANY:
--
--     src/lib/data/care.ts:2445  .from("care_agent_state")
--                                .eq("company_id", args.companyId)
--                                .eq("status", "online")
--
-- so the attacker now appears in the victim company's online-agent pool and gets ASSIGNED that company's
-- incoming support conversations (assigned_agent_id = attacker).
--
-- Impact — stated precisely, neither inflated nor minimised:
--   • NOT exfiltration. The attacker still cannot READ the conversation: support_conversations' RLS
--     requires the caller's profiles.company_id to equal the conversation's company_id, and the attacker's
--     profile still belongs to their own company. No message content leaks.
--   • It IS a cross-tenant denial of service. The victim's conversations are assigned to an agent who can
--     never answer them, and the victim's real agents see them as taken. Their customer support queue
--     silently drains into a black hole.
--   • Reachability: requires an agent account (a care_agent_state row exists per agent, bootstrapped by
--     0045) and knowledge of the target company's UUID, which the product does not expose. So: an insider
--     at any customer company, not an anonymous attacker.
-- Severity: MEDIUM. Availability/integrity across a tenant boundary, no data exfiltration.
--
-- Fix — defence in depth, matching this codebase's established pattern for exactly this shape
-- (0068 freezes chat_messages.company_id by trigger; 0090 freezes profiles.role/company_id):
--
--   (1) RLS: the self-update WITH CHECK pins the tenant — an agent may only keep their own row in their
--       OWN company. (The sibling "admin update" policy is already tenant-scoped via its exists() on
--       profiles.company_id = care_agent_state.company_id, so it needs no change.)
--   (2) Trigger: company_id (and agent_id) are FROZEN on update. A trigger is strictly stronger than RLS
--       here because it also binds service-role writes, which RLS does not — the same reason 0068/0090
--       use one. care_agent_state.company_id is derived from the agent's profile at bootstrap (0045) and
--       has no legitimate reason to ever change; presence/capacity (status, channels, max_concurrent,
--       last_seen_at) remain freely updatable.
--
-- Legitimate flows are unchanged: an agent toggling online/offline or capacity updates status/channels/
-- max_concurrent, never company_id. An admin adjusting another agent's capacity goes through the
-- (already tenant-scoped) admin-update policy and likewise never moves the row between companies.
--
-- Idempotent (drop/create). No data change.
--
-- NOT verified against a live DB by the agent (no DB access). After applying, smoke-test:
--   (1) an agent can still go online/offline and change capacity;
--   (2) an admin can still adjust an agent's state in their own company;
--   (3) `update care_agent_state set company_id = '<other company>'` now FAILS.

-- ─── (1) RLS: pin the tenant on self-update ───────────────────────────
drop policy if exists "care_agent_state - self update" on care_agent_state;
create policy "care_agent_state - self update" on care_agent_state
  for update
  using (agent_id = auth.uid())
  with check (
    agent_id = auth.uid()
    -- Tenant pin: an agent may not move their presence row into another company's routing pool.
    and company_id = auth_company_id()
  );

-- ─── (2) Trigger: freeze the identity columns (binds service-role too) ─
create or replace function care_agent_state_freeze_identity()
returns trigger language plpgsql security invoker as $$
begin
  if NEW.company_id is distinct from OLD.company_id then
    raise exception 'care_agent_state: company_id is immutable — an agent''s presence row cannot move between companies';
  end if;
  if NEW.agent_id is distinct from OLD.agent_id then
    raise exception 'care_agent_state: agent_id is immutable — the row IS that agent''s presence record';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_care_agent_state_freeze_identity on care_agent_state;
create trigger trg_care_agent_state_freeze_identity
  before update on care_agent_state
  for each row execute function care_agent_state_freeze_identity();
