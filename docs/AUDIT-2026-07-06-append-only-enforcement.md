# Focused audit — §3.1 append-only ENFORCEMENT strength — 2026-07-06

> Outside-view audit (§1.3) under [CLAUDE.md §1.7](../CLAUDE.md). Trigger: while
> allowlisting append-only tables in the RLS audit (commits `fb8c011`/`453ff57`),
> the question arose — is §3.1 immutability ENFORCED at the DB level (a
> `do instead nothing` rule, which blocks even the service-role), or only by
> RLS-absence (no update/delete policy — which the **service-role bypasses**)?
> RLS-absence stops a user-client; it does NOT stop a buggy server write. The
> strong, constitutional form (§3.2 — encode the guarantee, don't leave it to
> discretion) is the DB rule.

## Severity scale

- 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## Method

For every table allowlisted as "§3.1 append-only," check for a
`create rule … do instead nothing` on update/delete (DB-enforced) vs only a
missing RLS policy (bypassable by service-role).

## Results

**Solid — DB-rule-enforced (service-role cannot mutate):**
- **All coaching tables** (my domain): `coaching_transcript_segments`,
  `coaching_cues` (0070; the update rule is correctly re-created in 0073 after the
  company_id add), `coaching_cue_outcomes`, `after_pitch_summaries` (0080),
  `sales_coach_corpus_versions` (0074). Every one has no_update + no_delete rules.
  §3.1 here is structural, not disciplinary. ✓
- **Core C.A.R.E chain**: `support_messages` (0034), `support_conversation_events`
  (0035), `support_resolutions`, `support_ai_co_pilot_edits` (0036) — all
  `do instead nothing`. ✓

**Flags:**
- 🟡 **`crm_activity_events` — append-only by DECLARATION, not by DB rule.**
  0049 comments it "append-only per §3.1", and RLS grants no update/delete policy,
  but there is NO `do instead nothing` rule — so the service-role could update or
  delete an activity event, silently breaking the immutable chain a future
  retrospective analysis (§1.2) depends on. *Write path not yet traced* (no direct
  `.insert()` found via grep — likely a helper/RPC), so DO NOT add a rule blindly:
  first confirm it is insert-only, then add no_update + no_delete rules in a new
  migration. CRM domain — founder's call.
- 🟢 **`care_widget_load_events` — same gap, confirmed insert-only.** Written only
  via `admin.from(...).insert(...)` (config.ts, email/outbound.ts); pure widget-
  bootstrap telemetry. RLS grants no update/delete, but no DB rule backs it. Low
  stakes (telemetry), but for consistency it should get no_update + no_delete
  rules. Safe to harden (confirmed insert-only). C.A.R.E domain.

**Not a gap (checked):**
- `support_durability_checks` — has an UPDATE policy (a scheduled check is updated
  with its result), so it is legitimately not fully-immutable; only delete is
  absent (append-of-checks). Correct as-is.

---

## Recommendation

One small new migration adding `do instead nothing` update+delete rules to
`care_widget_load_events` (confirmed safe) and — after confirming its write path
is insert-only — `crm_activity_events`. This brings every §3.1-declared table to
the same STRUCTURAL enforcement the coaching + core-C.A.R.E tables already have,
so immutability can't be violated by a future service-role code path. Findings
only (§1.7.5); not a blocker. Deferred to the founder as a C.A.R.E/CRM-domain call.
