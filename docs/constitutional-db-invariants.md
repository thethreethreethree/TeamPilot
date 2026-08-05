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

> **LIVE RE-VERIFICATION 2026-08-06 (read-only prod catalog — `pg_rules` + `pg_trigger`).** Re-checked
> against the running database, not the migrations. **The three then-pending objects are now LIVE:**
> `care_widget_load_events` (`care_widget_load_events_no_update` + `_no_delete`) and `crm_activity_events`
> (`crm_activity_events_no_update` + `_no_delete`) append-only rules are present; the
> `resolutions_durability_review_trigger` (`0100`, listed UNAPPLIED below) is present on `resolutions`. The
> applied-state caveat above is therefore RESOLVED for those. The freeze/immutability trigger set is intact
> (`events`-chain rules present; `decision_dialogues_immutable`, `resolutions_immutable`,
> `team_invitations_immutable`, `chat_topics_immutable`, and the full `fin_*` freeze set all live).

> **Applied-state caveat (historical — see the 2026-08-06 resolution above).** This registry describes the
> schema **as defined by the migrations** (i.e. assuming all are applied). A few of the listed rules shipped in
> migrations that were still in the pending-apply queue as of 2026-07-09 — notably
> `care_widget_load_events` (`0085`) and `crm_activity_events` (`0086`) append-only. Their
> protection is live only once those migrations are applied to the environment; see the
> pending-migration list in `docs/closures/2026-07-09-SESSION-SUMMARY.md`. Migration-defined
> ≠ prod-live until applied.

---

## §3.1 — Immutability (events are append-only; state is derived, never edited)

**Complete append-only set (verified 2026-07-09).** Every table below is enforced by a
`do instead nothing` rule on UPDATE + DELETE (`<table>_no_update` / `_no_delete`). This is
the FULL current set — 22 tables — not a highlight; a reviewer touching any of them must
confirm the rule survives. Authoritative always-current check (re-run to detect additions):
`grep -rhoE "on (update|delete) to [a-z_]+ do instead nothing" supabase/migrations/*.sql | sort -u`.

> **Enforcement-model exceptions (live-verified 2026-08-06 — do NOT "fix" these to a `_no_update` rule).**
> Three tables in the set are NOT frozen by a `_no_update` rule; a rule-only audit will show a FALSE gap for
> them (verify the TRIGGER before flagging — behavioral-beats-catalog-string):
> - `chat_messages` — `_no_delete` rule + `chat_messages_guard_edit_trg` (BEFORE UPDATE) + `chat_messages_emit_edit_event_trg`.
>   Edits are ALLOWED but *event-sourced* (each edit emits an append-only event) — a richer append-only model
>   than a freeze. Adding a `_no_update` rule would BREAK message editing.
> - `support_messages` — `_no_delete` rule + `trg_preserve_support_message_content` (BEFORE UPDATE freezes the
>   content column; status/read-flags may still change). Content is immutable; the row is not.
> - `smoke_test_versions` — `_no_delete` only; UPDATE is permitted (test infrastructure, not a constitutional
>   event-chain table — benign by design).

```
after_pitch_summaries      coaching_cues                  smoke_test_results
brain_evolution_events     coaching_transcript_segments   smoke_test_versions
care_widget_load_events    crm_activity_events            support_ai_co_pilot_edits
chat_messages              decision_dialogues (+0025)     support_conversation_events
coaching_cue_outcomes      events                         support_messages
feedback                   problem_signals                support_resolutions
resolutions (delete-only)  sales_coach_corpus_versions    task_messages
signals
```

**High-salience rows (the core chain — a DROP here is most consequential):**

| Table | Enforcing object | Migration | A DROP would let… |
|---|---|---|---|
| `events` | `events_no_update` / `_no_delete` rules | `0004` | the chain be rewritten — retrospective analysis (§1.2) reasons from a falsified history |
| `signals` | `signals_no_update` / `_no_delete` rules | `0002` | derived signals be edited, breaking the events→signals→problems chain |
| `problem_signals` | `problem_signals_no_update` / `_no_delete` rules | `0002` | the evidence trail behind a surfaced problem be edited after the fact |
| `decision_dialogues` | `decision_dialogues_no_update` rule (`0025`) + `decision_dialogues_immutable` column-freeze trigger (`0003`) | `0025` + `0003` | a recorded guide-don't-overtake dialogue + its reasoning be silently altered |
| `brain_evolution_events` | `brain_evolution_no_update` / `_no_delete` rules | `0007` | the System's own learning record be rewritten |

**Column-freeze triggers** (the row stays, but specific columns can't change) — full set:
`chat_topic_decisions` (`chat_topic_decisions_immutable`, freezes once `phase='decided'`, `0022`);
`resolutions` (`check_resolution_immutability`, freezes `action_taken`/`reasoning`/`decided_at`,
`0005` — but `observed_outcome`/`durability` intentionally mutable-once, see A27);
`decision_dialogues` (`0003`, freezes the dialogue fields); `chat_topics` + `team_invitations`
(freeze identity/ownership columns). A DROP lets the frozen column be rewritten after capture.

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
| Every change to a resolution's `durability` appends a `resolution.durability_reviewed` event → derives a resolution_held / problem_recurrence / partial_resolution signal | `resolutions_durability_review_trigger` → `resolutions_emit_durability_review()` | `0100` (UNAPPLIED) | the resolutions-table half of the §3.1 loop stay open — a reopened resolution (problem recurrence) would never re-enter events→signals, exactly the gap 0015 closed for chat topics |

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
  exposure. See A27. NOTE: the *event-sourcing* half of this gap is now closed by `0100`
  (UNAPPLIED) — a durability change now emits `resolution.durability_reviewed` and derives a
  signal, mirroring `0015`. What remains app-layer-only is the *write-once* enforcement (the
  column can still change at the DB layer; the trigger records each change honestly rather
  than freezing it — consistent with 0015, where re-review is allowed and re-emits).
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
