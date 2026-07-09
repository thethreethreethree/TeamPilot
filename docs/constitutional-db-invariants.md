# Constitutional DB invariants — the registry

The constitution's structural core is not enforced by application code — it is **compiled
into the schema** as triggers and rules that application code cannot bypass. This file is
the registry of those invariants: what each guarantees, the constitution section it serves,
the migration + object that enforces it, and what a silent DROP would break.

**Why this exists.** `npm run check` verifies code (tsc / lint / theme / RLS-coverage /
tests) but does NOT verify these DB triggers/rules stay in place. A future migration that
drops one would pass the green gate while silently removing a constitutional guarantee (the
§5 "a protection gets dropped under pressure" risk, at the schema layer). Until CI runs the
skipped `chain.integration.test.ts` against a live DB (or an order-aware invariant check is
added to `rls-audit.mjs`), this registry is the **human-review** defense: a reviewer seeing a
migration touch any object below must confirm the invariant survives.

Verified present as of 2026-07-09 (each checked against the actual trigger/rule, not a comment).

---

## §3.1 — Immutability (events are append-only; state is derived, never edited)

| Table | Enforcing object | Migration | A DROP would let… |
|---|---|---|---|
| `events` | `do instead nothing` on update + delete | `0004` | the chain be rewritten — retrospective analysis (§1.2) reasons from a falsified history |
| `problem_signals` | `problem_signals_no_update` / `_no_delete` rules | `0002` | the evidence trail behind a surfaced problem be edited after the fact |
| `decision_dialogues` | `decision_dialogues_no_update` rule (`0025`) + `decision_dialogues_immutable` column-freeze trigger (`0003`) | `0025` + `0003` | a recorded guide-don't-overtake dialogue + its reasoning be silently altered |
| `brain_evolution_events` | `do instead nothing` on update + delete | `0007` | the System's own learning record be rewritten |
| `chat_topic_decisions` | `chat_topic_decisions_immutable` trigger (freezes once `phase='decided'`) | `0022` | a decided in-thread dialogue's chosen path / reasoning change after the fact |
| `resolutions` | `check_resolution_immutability` trigger (freezes `action_taken` / `reasoning` / `decided_at`) | `0005` | the captured decision + why be edited (NOTE: `observed_outcome`/`durability` are intentionally mutable-once; see A27 + the write-once route guard) |

## §3.2 — Understanding Gate (a problem cannot surface under-supported)

| Guarantee | Enforcing object | Migration | A DROP would let… |
|---|---|---|---|
| A problem cannot leave `draft` (to `surfaceable`/`surfaced`) unless it meets, per-kind: `min_signals`, `min_distinct_sources`, `min_diagnosis_chars` | `problems_understanding_gate` trigger → `check_understanding_gate()` | `0002` | half-understood problems reach a human — the §0 "understanding precedes solving" law becomes discretionary instead of structural |

**Bypass-hardened:** the trigger fires `BEFORE INSERT OR UPDATE` and its surfacing test
covers `TG_OP='INSERT' AND NEW.status<>'draft'`, so a problem inserted *directly* as
`surfaced` is still gated (a common UPDATE-only-trigger bypass — closed here).

## §3.5 — Consequence measurement (durability is captured immutably)

| Guarantee | Enforcing object | Migration | A DROP would let… |
|---|---|---|---|
| Every change to a topic's `close_durability` appends a `chat.topic_durability_reviewed` event (new + previous value) | `chat_topics_durability_review_trigger` → `chat_topics_emit_durability_review()` | `0015` | durability-over-time history be lost — the §3.5 consequence metric would live only in a mutable column |

## Security invariants (privilege-escalation defenses)

| Guarantee | Enforcing object | Migration | A DROP/edit would let… |
|---|---|---|---|
| Every `SECURITY DEFINER` function pins `search_path` | per-function `set search_path = public` (last gap fixed) | `0088` (task_message_emit_event), `0096` (3 guard fns), all others at definition | search_path-injection: a caller shadowing `public` objects earlier in their path escalates via the definer function |
| Vendor CRM (all-companies back-office) is admin-of-the-VENDOR-company only | `is_vendor_super_admin()` (role IN admin AND `company_id = <vendor>`) | `0089` | any customer admin read/mutate the entire cross-customer CRM (the 2026-07-07 CRITICAL bug) |
| Authz-bearing columns frozen against direct end-user writes | `profiles_guard_privileged` (`0090` update + `0091` insert), `chat_participants_guard_privilege` (`0093`), `care_agent_state_guard_admin_cols` (`0095`) | `0090`/`0091`/`0093`/`0095` | a user self-escalate role/company/agent-caps via a direct column write (A23 class). NOTE: `0092` is the role-default-null fix, not a guard trigger. |

---

## Known enforcement asymmetries (documented, not bugs)

- **`resolutions` durability review** is write-once at the **app layer only** (the route
  guard added 2026-07-09), NOT a DB trigger — the 0005 trigger permits `durability` to change.
  A direct service-role write could still overwrite it. Fails toward data-quality, not
  exposure. See A27 + the resolutions event-sourcing decision (mirror `0015`) in
  `docs/closures/2026-07-09-SESSION-SUMMARY.md`.
- **`support_durability_checks`** (care) has NO immutability trigger; write-once is enforced
  only in `recordDurabilityOutcome` (app layer, 2026-07-09). Same fail-toward-quality posture.
- **`is_vendor_super_admin()`** hardcodes the vendor company id (a SQL function can't read
  env). A deployment overriding `CARE_DEFAULT_TENANT_ID` must update the literal; it fails
  CLOSED (locks out, never exposes).

## Maintaining this registry

When adding a migration that creates a constitutional trigger/rule, add a row here. When a
review touches any object above, confirm the invariant survives the change. This registry is
only as honest as it is current — a stale registry is worse than none (it implies coverage
that lapsed). Cross-check against a `grep -rn "do instead nothing\|create trigger\|security definer" supabase/migrations`
periodically until CI enforces it.
