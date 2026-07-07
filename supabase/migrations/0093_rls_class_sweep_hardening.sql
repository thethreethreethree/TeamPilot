-- 0093 — RLS UPDATE/INSERT class-sweep hardening (audit 2026-07-07)
--
-- After the profiles CRITICAL (0090/0091), we swept every UPDATE RLS policy for
-- the same class defect: `USING` present, `WITH CHECK` absent, on a table where
-- mutating a column crosses a privilege or tenant boundary. The sweep found the
-- profiles CRITICAL is NOT replicated anywhere (no other policy allows
-- cross-tenant read/write or company-admin escalation). It found two genuine,
-- lower-severity holes, fixed here.
--
-- ─────────────────────────────────────────────────────────────────────────
-- (1) HIGH — chat_participants self-promotion to topic admin (0033:119)
-- ─────────────────────────────────────────────────────────────────────────
-- The redefined UPDATE policy is `USING (topic∈company AND (is_topic_admin OR
-- user_id = auth.uid()))` with NO WITH CHECK; the INSERT policy (0033:101) allows
-- self-insert (`user_id = auth.uid()`) with `role` unconstrained. The migration
-- comment (0033:130) asserts "They cannot promote themselves because the role
-- column update is checked by the existing triggers / API" — but NO such trigger
-- exists (the only chat_participants trigger, 0071, is BEFORE INSERT rejecting
-- participants on LOCKED topics), and a direct PostgREST PATCH never touches the
-- API. So an authenticated member could:
--   PATCH /rest/v1/chat_participants?topic_id=eq.<T>&user_id=eq.<self>
--   { "role": "admin" }
-- and is_topic_admin(T) (0033:46, reads role='admin') then returns true —
-- granting rename/close/coach-toggle of the topic, add/remove/re-role of other
-- participants, and close_topic(). In-tenant privilege escalation (HIGH).
-- The INSERT self-path is worse: a member could self-insert into ANY company
-- topic (any role), and because chat_messages SELECT is participant-gated, that
-- reads private topics they were excluded from (confidentiality breach).
--
-- LEGITIMATE flow that must survive (createTopic, src/lib/data/chats.ts:988):
-- the topic CREATOR self-inserts themselves as the first admin, via the user
-- client. Distinguishing key: a self-insert is legitimate only when the caller
-- IS the topic's creator (created_by = auth.uid()) or already a topic/company
-- admin. Role may CHANGE only at the hand of a topic admin.
--
-- WITH CHECK can't compare NEW.role to OLD.role (no OLD), so a BEFORE trigger is
-- required — composed from the 0090 pattern (privileged context exempt).

create or replace function guard_chat_participant_privilege()
returns trigger language plpgsql as $$
begin
  -- Service-role admin routes and SECURITY DEFINER fns pass untouched; only
  -- direct authenticated/anon PostgREST writes are guarded. (Under service-role,
  -- auth.uid() is null and the self-branch below would misfire — so exempt here.)
  if current_user not in ('authenticated', 'anon') then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    -- Self-insert is legitimate only for the topic creator seeding themselves,
    -- or an existing topic/company admin. A plain member self-inserting into a
    -- topic they did not create is the exploit (grants access + possibly admin).
    if NEW.user_id = auth.uid()
       and not is_topic_admin(NEW.topic_id)
       and not exists (
         select 1 from chat_topics t
         where t.id = NEW.topic_id and t.created_by = auth.uid()
       ) then
      raise exception 'chat_participants: you may only add yourself to a topic you created; a topic admin must add you to others';
    end if;
    return NEW;
  end if;

  -- UPDATE: role may only be changed by a topic admin. A member's own row-touch
  -- (leave / last_engaged_at) must not alter role.
  if NEW.role is distinct from OLD.role and not is_topic_admin(OLD.topic_id) then
    raise exception 'chat_participants.role may only be changed by a topic admin';
  end if;
  return NEW;
end $$;

drop trigger if exists chat_participants_guard_privilege on chat_participants;
create trigger chat_participants_guard_privilege
  before insert or update on chat_participants
  for each row execute function guard_chat_participant_privilege();

comment on function guard_chat_participant_privilege() is
  'Closes the 0033 chat_participants class hole: a direct authenticated PATCH could self-promote role->admin (no WITH CHECK, and the trigger the comment claimed never existed), and self-insert into any topic. Role changes require topic admin; self-insert requires being the topic creator or an admin. Privileged writers exempt. See 0093.';

-- ─────────────────────────────────────────────────────────────────────────
-- (2) MED — widget-logos storage.objects UPDATE cross-path relocation (0064:111)
-- ─────────────────────────────────────────────────────────────────────────
-- The UPDATE policy has `USING (bucket='widget-logos' AND foldername[1] =
-- auth_company_id())` but NO WITH CHECK, so `name` can be rewritten to a VICTIM
-- company's folder path. The INSERT twin (0064:100) already constrains the path.
-- The bucket is public and the widget loads brand logos by {companyId}/{file},
-- so the worst case is cross-tenant logo defacement. Add the mirroring WITH CHECK.
drop policy if exists "widget-logos: authenticated UPDATE own company path"
  on storage.objects;
create policy "widget-logos: authenticated UPDATE own company path"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'widget-logos'
    and (storage.foldername(name))[1] = auth_company_id()::text
  )
  with check (
    bucket_id = 'widget-logos'
    and (storage.foldername(name))[1] = auth_company_id()::text
  );
