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

**Flags — both RESOLVED 2026-07-06:**
- 🟡→✅ **`crm_activity_events`** — *[RESOLVED, migration `0086`]* Write path fully
  traced: every write is `insert into` in the 0049 SECURITY DEFINER triggers; the
  only code reference (crm/data.ts) is a `.select()` read; no update/delete/upsert
  anywhere. Confirmed insert-only → added no_update + no_delete rules (0086).
- 🟢→✅ **`care_widget_load_events`** — *[RESOLVED, migration `0085`]* Confirmed
  insert-only (`admin.from(...).insert(...)` in config.ts + email/outbound.ts);
  added no_update + no_delete rules (0085).

Both migrations UNAPPLIED (founder applies). Every §3.1-declared table in the
codebase now has the same DB-level structural enforcement.

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
