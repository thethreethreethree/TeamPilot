-- 0104 — chat_messages / support_messages INSERT: constrain `author_id` to self-or-null
--        (the row-level twin of 0103's events actor guard — same author-spoof class)
--
-- Why
-- ───
-- 0103 closed actor-spoofing on the `events` table. An A29 sweep of that class (an
-- authorship column WRITTEN BY THE CALLER but NOT CONSTRAINED to the caller in the INSERT
-- policy) found the same shape at the two message tables:
--
--   • chat_messages (0010:212) — WITH CHECK verifies the CALLER is a topic participant
--     (`p.user_id = auth.uid()`) and the company, but NOT that `author_id` is the caller.
--     `author_id` references auth.users. So any participant can PostgREST-insert a message
--     with `author_id = <a co-worker in the same topic>` → IMPERSONATION: a fabricated
--     message renders under a colleague's name in team chat. Chat feeds the §3.1 chain
--     (chat_messages_emit_events, 0012) and the brain, so a spoofed message also pollutes
--     problem-identification. Insider + same-tenant + same-topic scoped (not cross-tenant),
--     but a genuine trust/integrity breach in a team-diagnosis product. MED-HIGH.
--
--   • support_messages (0034:254) — WITH CHECK verifies the caller is an agent/admin in the
--     conversation's company, but not that `author_id` is the caller. An agent could post
--     as ANOTHER agent (`author_id = <peer>`). Lower consequence (trusted same-company
--     staff), same class. MED.
--
-- Why 0103 alone does NOT fully cover chat_messages (§1.5 — don't rely on a downstream door)
-- ────────────────────────────────────────────────────────────────────────────────────────
-- chat_messages_emit_events() (0012:90) is SECURITY INVOKER and stamps the event's `actor`
-- from NEW.author_id. So WITH 0103 applied, a spoofed author_id on a normal message makes
-- that trigger's `events` insert fail 0103's `actor = auth.uid()` check → the whole message
-- insert rolls back. That transitively blocks the *event-pollution* vector — but only for
-- kinds that emit an event. The trigger RETURNS EARLY for kind='system' (0012:100), so a
-- spoofed system-kind message emits no event, 0103 never fires, and the fabricated row
-- persists. And the transitive protection is fragile: it evaporates if 0103 is unapplied,
-- if the trigger is ever switched to DEFINER, or if it stops passing author_id as actor.
-- The row's own authorship key must be validated at ITS OWN table — the same principle 0103
-- applies to events. This migration is that direct guard; it does not depend on 0103.
--
-- Why the fix is safe (verified before applying, §0)
-- ──────────────────────────────────────────────────
-- Every user-reachable insert already sets author_id to self or null:
--   • chat_messages: postMessage (chats.ts:1138 `author_id: ctx.userId`), the three
--     topic-decisions routes (`author_id: auth.user.id`), and the SECURITY INVOKER SQL
--     functions close_topic (0010:262) + decide_chat_topic_decision (0027:40) — both set
--     `author_id := v_user_id` = auth.uid(); AI summaries post via postMessage (self) or null.
--   • support_messages: sendAgentMessage (care.ts) sets `author_id = agentId`, and
--     requireCareAgent (careAgentAuth.ts:94) sets `agentId := auth.user.id`; customer / ai /
--     system messages set author_id = null. Customer inbound (widget/email) is service-role
--     and bypasses RLS entirely.
-- So `author_id = auth.uid() OR author_id IS NULL` passes every legitimate path and blocks
-- only the spoof. Service-role and DEFINER writes bypass RLS, so pipelines are unaffected.
--
-- §A12 idempotent (DROP IF EXISTS then CREATE). STATUS: UNAPPLIED — founder applies alongside
-- the 0102/0103 authz queue. Recommended order: 0103 then 0104 (defense-in-depth pair).

-- ── chat_messages ────────────────────────────────────────────────────────────
drop policy if exists "chat_messages - insert" on chat_messages;
create policy "chat_messages - insert" on chat_messages
  for insert with check (
    company_id = auth_company_id()
    and (author_id = auth.uid() or author_id is null)
    and exists (
      select 1 from chat_participants p
      where p.topic_id = chat_messages.topic_id
        and p.user_id = auth.uid()
        and p.left_at is null
    )
  );

-- ── support_messages ─────────────────────────────────────────────────────────
drop policy if exists "support_messages - insert" on support_messages;
create policy "support_messages - insert" on support_messages
  for insert with check (
    (author_id = auth.uid() or author_id is null)
    and exists (
      select 1 from support_conversations c
      join profiles p on p.id = auth.uid()
      where c.id = support_messages.conversation_id
        and c.company_id = p.company_id
        and (p.is_support_agent or p.role in ('CEO', 'COO', 'admin'))
    )
  );
