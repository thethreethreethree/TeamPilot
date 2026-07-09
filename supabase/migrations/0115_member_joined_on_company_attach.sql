-- 0115 — F2 (MED, audit 2026-07-10): emit member.joined when an ALREADY-ACTIVE orphan
--        is attached to a company (company_id NULL → set), not only on a status change.
--
-- ⚠️ UNAPPLIED — low-risk (trigger logic only) but touches the §3.1 event chain; on
-- staging, attach an orphaned profile to a company and confirm exactly ONE member.joined
-- event + its derived signal appear. Then promote.
--
-- THE FINDING (0008:169-170). The emit condition required, for UPDATE,
-- `OLD.status <> 'active'`. But handle_new_user (0011) seeds a signup as
-- status='active', company_id=NULL. When that orphan is later wired to a company (via
-- accept_invitation's on-conflict-update, or a service-role provision), OLD.status was
-- ALREADY 'active', so the condition was false and NO member.joined event emitted — the
-- §3.1 chain never recorded the join. The real "joined" moment is the company_id NULL→set
-- transition, which the trigger did not test. (Confirmed live: the monebertalburomone
-- provision on 2026-07-09 produced no member.joined event.)
--
-- FIX. Fire on UPDATE when the row is now active + company-set AND it was EITHER not-active
-- before OR had no company before. One boolean predicate → no double-emit for a single
-- UPDATE that flips both. INSERT branch unchanged.

create or replace function emit_member_joined_event()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_event_id uuid;
begin
  if (TG_OP = 'INSERT' and NEW.status = 'active' and NEW.company_id is not null) or
     (TG_OP = 'UPDATE' and NEW.status = 'active' and NEW.company_id is not null
        and (OLD.status <> 'active' or OLD.company_id is null)) then
    insert into events (company_id, kind, subject, actor, payload)
      values (
        NEW.company_id,
        'member.joined',
        'user:' || NEW.id::text,
        NEW.id,
        jsonb_build_object('role', NEW.role, 'full_name', NEW.full_name)
      )
      returning id into v_event_id;
    perform derive_signals_for_event(v_event_id);
  end if;
  return NEW;
end;
$$;

-- Trigger binding is unchanged from 0008 (profiles_emit_member_joined). create-or-replace
-- of the function is picked up by the existing trigger; no trigger recreate needed.
