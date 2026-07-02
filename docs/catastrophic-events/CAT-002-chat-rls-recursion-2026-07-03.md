# CAT-002 — Team Chat outage: RLS infinite recursion masquerading as data loss

- **Date:** 2026-07-03
- **Severity:** Catastrophic — a core, customer-facing feature (Elostate Team
  Chat) was fully down (could not read topics or save messages), and it
  *presented as permanent data loss* ("my previous chats are gone"). No data
  was ever actually lost.
- **Duration to resolution:** multiple hours across several wrong diagnoses.
- **Final root cause:** an RLS **infinite recursion** (`42P17`) between the
  `chat_topics` and `chat_participants` SELECT policies.
- **Fix:** migration `0081` — a `security definer` helper
  `is_topic_participant()` that breaks the cross-policy loop.

---

## What happened (chain of events)

1. **The latent trap.** `0010` defined `chat_participants - select` as
   `exists (select 1 from chat_topics t where t.id = … and t.company_id =
   auth_company_id())` — it references **chat_topics**. At the time this was
   safe because `chat_topics - select` was just `company_id = auth_company_id()`
   (no back-reference).
2. **The trap armed.** `0071` (topic locking) recreated `chat_topics - select`
   to check membership **inline**:
   `… or exists (select 1 from chat_participants p where p.topic_id =
   chat_topics.id …)` — now referencing **chat_participants**. This created a
   mutual reference: chat_topics → chat_participants → chat_topics. (`0033` had
   already established the correct pattern — a `security definer` helper,
   `is_topic_admin()` — for exactly this reason, but only for the UPDATE/INSERT
   policies. The SELECT path was left inline.)
3. **The trap sprung.** The DB lost/regained the chat columns and `0071` was
   **re-applied on its own** (out of the full migration sequence). Re-applying
   `0071` recreated the recursive `chat_topics - select` policy. Now every chat
   read evaluated chat_topics → chat_participants → chat_topics → … and Postgres
   aborted with `42P17: infinite recursion detected in policy for relation
   "chat_participants"`. All chat reads and topic creation failed.
4. **Disguised as data loss.** `fetchTopics` swallowed the query error into
   `{ topics: [], mode: "live-empty" }`, so the UI rendered the benign empty
   state ("Start your first conversation"). The founder reasonably concluded the
   chats had been deleted. They had not — the rows were intact the entire time;
   the DB simply refused to evaluate the looping policy.

## Why it took so long (the agent's failure)

The agent made **three wrong diagnoses in sequence** before the truth surfaced:
1. "Migrations 0071/0076 not applied → missing columns (42703)" — plausible but
   wrong; shipped a guarded self-heal that couldn't help.
2. "The `chat_topic_with_counts` view is stale/broken" — wrong; shipped a
   base-table fallback that *also* hit the recursive `chat_topics` policy.
3. Only after shipping the **honest-error surface** (F2 — distinguishing
   `live-error` from `live-empty` and displaying the Postgres code) did the real
   cause appear on screen: `42P17`. That single honest error ended the guessing.

This is a §2 **error-loop**: repeated failure meant the *identification* was
wrong each time, and the agent kept re-guessing instead of making the system
report the actual error first.

## Contributing factors (each a rule below)

- **Audit-induced fragility.** Commit `373e18c` (audit remediation "M2")
  *removed* `fetchTopics`/`createTopic`'s fallback, justified in the commit as
  *"0076 is applied"* — an **unverified, point-in-time assertion baked into code
  as permanent truth** (§A19/§A22). An audit that "hardens" by deleting a safety
  net inverted AMD-006's sieve: it improved a narrow purity concern (§1.5/§2, no
  scope-mixing) while breaking the foundational layer (L2 — the feature working
  at all).
- **Error-swallow-to-empty.** `fetchTopics` returning `live-empty` on error
  (§3.4/A14) is what turned a recoverable policy loop into an apparent
  catastrophe and hid the cause for hours.
- **Out-of-sequence migration re-apply.** Re-applying `0071` alone reintroduced
  a recursion that the codebase's own pattern (`0033`) knew how to avoid.

## The fix (migration 0081)

```sql
create or replace function is_topic_participant(p_topic_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from chat_participants
    where topic_id = p_topic_id and user_id = auth.uid() and left_at is null
  );
$$;

drop policy if exists "chat_topics - select" on chat_topics;
create policy "chat_topics - select" on chat_topics
  for select using (
    company_id = auth_company_id()
    and (locked = false or is_topic_participant(id))
  );
```

The membership check now runs `security definer`, so it reads
`chat_participants` **without** re-entering its RLS — the loop cannot form.
Visibility is identical. Confirmed working by the founder.

---

## Preventive rules (so this class cannot recur)

1. **RLS cross-table recursion is forbidden by construction.** An RLS policy on
   table A must not query table B under RLS when B's policy queries A. For any
   cross-table membership/ownership check inside a policy, use a
   `security definer` helper (the `is_topic_admin` / `is_topic_participant`
   pattern) so the check does not re-enter the other table's RLS. **Before
   shipping any policy that references another RLS-protected table, draw the
   reference graph and confirm there is no cycle.**
2. **A migration that recreates a policy must not regress a later migration's
   hardening.** `0071` recreated a SELECT policy inline that `0033`'s pattern
   would have made recursion-safe. When recreating any policy, check whether a
   later migration hardened the same object, and preserve that hardening.
3. **Never re-apply a single migration out of sequence.** Re-apply forward
   through the latest migration, or verify no later migration depends on / hardened
   what the re-applied one recreates. A targeted single-migration re-apply is a
   known footgun (this incident).
4. **Never remove resilience on an unverified "migration applied" assertion**
   (§A19/§A22). Code requiring a recently-added column/policy keeps a guarded
   fallback until the migration is verified applied *per environment*; remove it
   only deliberately, with verification — never on an assumption written in a
   comment.
5. **Never render a read error as an empty/benign state** (§3.4/A14). Distinguish
   error from empty and surface the real error (code + message). Making the error
   honest is what solved this — it should be the default, not a fix applied after
   an outage.
6. **When you cannot see the DB, make the system report the exact error before
   guessing** (§2 + diagnostic-logging-first). Three wrong diagnoses happened
   while guessing at an invisible DB; the truth arrived the instant the error was
   surfaced. Instrument/surface first, hypothesize second.
7. **"Data is gone" must be proven against the record before it is believed**
   (§3.1). The app is append-only with no delete path, so apparent data loss is
   almost always a failed *read*, not a real *delete*. Confirm with a
   ground-truth count before treating loss as real.

## Constitutional grounding

§0/§2 (understand from the record; no error loops), §1.5 (holistic — code +
schema move together), §3.1 (append-only; loss must be proven), §3.4 + A14
(honest states; error ≠ empty), §A5 (ripple-trace admin/membership checks
across every layer — the `0033` closure that SELECT was left out of),
§A12 (migrations safe by construction — extend to "re-applyable in sequence"),
§A19/§A22 (never assert a state without verifying), AMD-006 L2 (a feature that
does not work end-to-end is not shippable, regardless of how clean the layer
above looks).
