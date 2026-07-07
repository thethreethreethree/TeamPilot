# Apply + verify runbook — 2026-07-07 session (migrations 0095–0097 + guard triggers)

Concrete steps to apply the pending migrations and verify the security guards +
the Dissect feature actually work. Closes the "untested" gaps I flagged. All 8
session migrations (0090–0097) are §A12-safe to re-run, so an interrupted apply
can be retried without error.

## 1. Apply (order matters — ascending)
0095 → 0096 → 0097. (0089–0094 already applied.) Watch for any error; there should
be none. If interrupted, re-run the same file — idempotent.

## 2. Verify the security guards (Supabase SQL editor, as an AUTHENTICATED test user)
Run these AS A NON-ADMIN member of a NORMAL customer company (not the vendor).
Each should FAIL / affect 0 rows — that is the guard working.

- **0090/0091 — profiles role/company_id frozen (the CRITICAL):**
  ```sql
  update profiles set role = 'admin' where id = auth.uid();
  -- expect: ERROR "profiles.role is system-managed …"
  update profiles set company_id = 'c3e7f389-3df6-48c8-876b-0cd4baf5c2a7'
    where id = auth.uid();
  -- expect: ERROR "profiles.company_id is system-managed …"
  ```
  A non-privileged field must still work:
  ```sql
  update profiles set full_name = full_name where id = auth.uid();  -- expect: OK
  ```

- **0093 — chat_participants self-promotion frozen:** as a plain 'member' participant
  of a topic T:
  ```sql
  update chat_participants set role='admin' where topic_id='<T>' and user_id=auth.uid();
  -- expect: ERROR "chat_participants.role may only be changed by a topic admin"
  ```

- **0094 — resolutions append-only:**
  ```sql
  delete from resolutions where id = '<any resolution in your company>';
  -- expect: 0 rows affected (the no-delete rule silently drops it)
  ```

- **0095 — care_agent_state capacity frozen for agents:** as a support agent (non-admin)
  on your own row:
  ```sql
  update care_agent_state set max_concurrent = 99 where agent_id = auth.uid();
  -- expect: ERROR "care_agent_state.max_concurrent is admin-managed …"
  update care_agent_state set status = 'online' where agent_id = auth.uid();
  -- expect: OK (status is agent-controlled)
  ```

## 3. Verify legitimate flows still work (the guard-trigger regression check — CRITICAL)
These exercise the guards' EXEMPT paths (SECURITY DEFINER RPCs + service-role). If
any errors with a "…is system-managed / may only be changed by" message, the
`current_user` exemption assumption is wrong for this Supabase project — tell me the
exact string and I'll adjust `guard_profile_privileged_columns` (0090/0091).

1. **New-company onboarding** — sign up a fresh test user, complete onboarding.
   Exercises `complete_company_onboarding` setting `role='admin'`. Must succeed.
2. **Create a team-chat topic** — exercises the 0093 trigger on the creator-seed
   (createTopic inserts the creator as `role:'admin'`). Must succeed.
3. **Toggle a support agent** (Care settings, as admin) — now a service-role write.
   Must flip.

## 4. Verify Dissect a Conversation (needs 0097 applied)
1. Open **Dashboard → Dissect a Conversation** (sidebar, or ⌘K "dissect").
2. Paste a real conversation with a problem in it → **Dissect**. Expect: summary +
   a problem statement + evidence quoted from YOUR text (no invented quotes) +
   root cause + outside view + angles.
   - Thin/no-problem paste → honest "no clear problem" state (not a fabricated one).
3. **Ask Coach** → ask "how do I solve this?" WITHOUT sharing your thinking first.
   Expect: the coach asks what YOU think first (§3.3). Answer it → expect the coach
   now BUILDS on your answer (not another "what do you think?" — that was the loop bug).
4. **Save the topic** → it appears in the Saved list; reload it. **Close** on an
   unsaved topic → clean slate.
5. Turn on **Learning Mode** (the FAB) → hover the header / problem / Ask Coach →
   the what/why/how hints appear.

## 5. Then tell me
Any failure string from §2/§3/§4, or "all green." §3 is the one that could indicate
a real prod regression from the security hardening; §2/§4 confirm the new behavior.
