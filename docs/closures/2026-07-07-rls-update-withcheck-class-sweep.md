# RLS UPDATE/INSERT `WITH CHECK` class sweep (2026-07-07)

Triggered by the profiles CRITICAL (0090/0091): after fixing the root, apply the
class-check one level up (§1.2) — is "an UPDATE policy with `USING` but no
`WITH CHECK` on a table where mutating a column crosses a boundary" replicated
elsewhere? Swept all 21 UPDATE policies. Every finding below re-verified from
source (§A19/§A22), not taken from the sweep agent's word.

**Controlling nuance:** `USING (company_id = auth_company_id())` with no `WITH
CHECK` is only MED — `USING` requires the OLD row already be in your tenant, so you
can push your own row OUT (vandalism) but cannot pull another tenant's row IN. It
rises to HIGH/CRITICAL only when the mutated column changes what your identity/tenant
resolves to (the profiles case) or grants a privilege.

## Result: the profiles CRITICAL is NOT replicated

No other UPDATE policy allows cross-tenant read/write or company-admin escalation.
Two genuine lower-severity holes found + fixed (migration 0093).

## HIGH — chat_participants self-promotion to topic admin — FIXED (0093)

**File:** `supabase/migrations/0033_chat_rls_hardening.sql:119` (UPDATE) + `:101` (INSERT).
**Verified:** the UPDATE policy is `USING (...)` with no `WITH CHECK`; the only
chat_participants trigger (0071) is `BEFORE INSERT` on locked topics — **not** the
role freeze the 0033:130 comment claims ("checked by the existing triggers / API").
`is_topic_admin` (0033:46) reads `role='admin'`. So a member could
`PATCH chat_participants {role:"admin"}` on their own row → topic-admin powers
(rename/close/coach-toggle, add/remove/re-role others, close_topic). The INSERT
self-path (`user_id = auth.uid()`, role unconstrained) is worse: self-insert into
ANY company topic → since chat_messages SELECT is participant-gated, read private
topics they were excluded from (confidentiality).

**Fix — 0093:** `BEFORE INSERT OR UPDATE` trigger `guard_chat_participant_privilege`.
Role may change only via a topic admin; self-insert allowed only for the topic
creator (`created_by = auth.uid()`) or an existing admin. Privileged context exempt
(0090 pattern). Verified the legitimate creator-seed (createTopic,
src/lib/data/chats.ts:988, user client, role:"admin") survives — at seed time the
topic's created_by IS the caller. No user-client role-CHANGE flow exists in code
(grepped — the only role write anywhere is the seed), so nothing else breaks.

## MED — widget-logos storage.objects UPDATE cross-path relocation — FIXED (0093)

**File:** `supabase/migrations/0064_...:111`. UPDATE policy had `USING (bucket +
own-company folder)` but no `WITH CHECK`, while its INSERT twin (:100) constrains the
path — so `name` could be rewritten into a victim company's folder. Public bucket +
logo-by-{companyId} load path → worst case cross-tenant logo defacement (blunted by
storage physical-key semantics, hence MED). **Fix:** added the mirroring `WITH CHECK`.

## The rest (MED-or-lower, on record, not changed)

Either trigger-defended or `company_id = auth_company_id()` vandalism/integrity with
no cross-boundary read: companies (member can edit own-company metadata — no admin
gate, but no authz column; separate LOW nit), team_invitations / chat_topics /
chat_topic_decisions / departments / files / chat_messages (all freeze-triggered),
chat_pins, feedback, smoke_test_versions, task_participants, support_customers /
support_conversations / support_durability_checks, care_agent_state, coaching_sessions.

**Structural note (§1.2):** the recurring MED-tier pattern is "column-level discipline
enforced at the API layer, not the DB" (stated verbatim in 0018/0034/0042) — the same
client-trust assumption that produced the profiles CRITICAL and this chat_participants
HIGH. Adding matching `WITH CHECK` / freeze triggers to the MED tier is the systemic
close-out; none is individually cross-tenant today, so logged as a follow-up, not built.

Founder must apply 0093 (with 0090–0092 and the still-pending 0085–0089).

---

## DELETE-policy class sweep (same day) → 0094

Applied the same discipline to DELETE. §3.1 makes append-only load-bearing for the
`events → signals → problems → resolutions` chain, so an over-permissive DELETE (or a
delete on a should-be-immutable table) is the analogous defect.

**Append-only chain verified complete** — `do instead nothing` no-delete rules on
events (0004), signals + problem_signals (0002), support_resolutions (0036),
brain_evolution_events (0007), chat_messages (0010), feedback + smoke_tests (0018).

**MED — resolutions member-deletable — FIXED (0094).** resolutions carries an
UPDATE-only immutability trigger (0005:50, freezes action_taken/reasoning/decided_at)
but its RLS is `for all` with no no-delete rule → any company member could DELETE the
close-the-loop record via direct PostgREST, bypassing the trigger. Contradicts §3.1
("never delete — append") and §1.1 ("nothing discarded; past resolutions are reusable
material"). Fix: `resolutions_no_delete` rule. UPDATE left alone (§3.5 outcome fills).
`problems` intentionally not touched — mutable status-lifecycle state, RLS
deny-by-default to members (RLS enabled, no policy), history in the events chain.
Verified no code deletes resolutions or problems.

**The 7 intentional DELETE policies — all clean (own-tenant/owner/admin, no
cross-tenant):** chat_pins (company + active participant, 0016), team_invitations
(company, 0017), notification_subscriptions (own user_id, 0029), task_steps (company
member, 0032 — history preserved in events), profile_departments (admin + same
company, 0055), widget-logos storage (own path, 0064), file_access_grants
(uploader/admin, 0065).

Founder must also apply 0094.
