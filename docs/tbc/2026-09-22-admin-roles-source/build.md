# BUILD — one decision, forty-eight copies, one of them edited

## What was built

One migration. No application change — `ADMIN_ROLES` in `roles.ts` was already correct; the
database is what disagreed with it.

### `admin_roles()` — the one place the list lives

- **write-path:** `supabase/migrations/0265_admin_roles_single_source.sql` creates
  `public.admin_roles() returns text[]`, returning `array['CEO','CFO','COO','admin']`.
- **read-path:** all 47 policies that previously inlined the list. Verified by a probe that
  changes ONLY the function and watches the policies' behaviour follow it.

`STABLE`, not `IMMUTABLE`: it reads nothing, but `IMMUTABLE` would license the planner to fold the
list at plan time, and the entire point of this function is that its definition changes again.
No `SECURITY DEFINER` — it touches no table, so there is nothing to elevate, and a definer function
inside 47 RLS policies is a much larger thing to get right than this needs to be.

### The 47 policies, re-emitted with one literal swapped

```
profiles.role = ANY (ARRAY['CEO'::text, 'COO'::text, 'admin'::text])
→ profiles.role = ANY (admin_roles())
```

- **write-path:** 47 `drop policy if exists` + `create policy` pairs across 36 tables, generated
  from `pg_policies` rather than typed. Every surrounding condition — every tenant check — is
  exactly what was there before.
- **read-path:** the policies are the read-path; Postgres consults them on every statement against
  those 36 tables.

**Generated, not hand-written, and that is the point.** The 47 share one literal but not the
predicate around it: most check `profiles.company_id = <this table>.company_id`, while
`profile_departments` joins `profiles me` to `profiles target` because the row has no `company_id`
of its own. Hand-rewriting 47 tenant checks is where a cross-tenant read gets introduced — A30's
own incident is 19 views that did exactly that, one of them exposing every tenant's taxpayer IDs.

## Why not `is_company_admin(company uuid)`

That was the shape first proposed and it unifies two things, not one: the admin-role list, which
drifted, and the tenant-scope expression, which did not. The second is the tenant boundary. This
build changes the part that broke and leaves the part that did not, byte-for-byte.

The property asked for holds either way: the next role change is one line.

## The form of the statements, which is not cosmetic

The generator first emitted `create policy "x" on public.t AS PERMISSIVE for select …`, which is
what `pg_policies` reports and is exactly equivalent (PERMISSIVE is the default; all 47 are
permissive — checked).

`scripts/rls-audit.mjs` would not have matched **one** of them. Its parser requires `for <op>` to
follow the table name immediately:

```js
/create\s+policy\s+(?:"[^"]+"|\w+)\s+on\s+(?:public\.)?(\w+)\s+for\s+(select|insert|…)/
```

`AS PERMISSIVE` in between and the audit reports 36 tables as having lost their coverage, on a
migration that changed none of it. An absence a gate invents is indistinguishable from one it
found. The clause is omitted, the audit's parser is untouched, and that exact regex run over the
file matches **47 of 47**.

## Ripple

- **36 tables** get their policies re-created: agent_baseline, agent_point_ledger, care_agent_state,
  care_knowledge_documents, care_tenant_config, coaching_cues, coaching_sessions,
  coaching_transcript_segments, departments, door_knocks, file_access_grants,
  file_classification_suggestions, file_departments, file_tags, file_tasks, files,
  gamification_calibration, growth_record, kpi_snapshot, pitch_analyses, pitch_transcripts,
  pitches, profile_departments, rep_daily_sales_goal, rep_day_target, rep_pattern_summaries,
  sales_coach_corpus_versions, support_ai_co_pilot_edits, support_canned_responses,
  support_conversation_tags, support_conversations, support_customers, support_durability_checks,
  support_messages, support_resolutions, support_tags.
- **No window without a policy.** Each migration runs in its own transaction, so the drop and the
  create are atomic together.
- **`team_invitations - insert` is untouched.** It is the one policy that already had the complete
  list, and it uses a second array for a different job (which roles COUNT as C-Suite to invite).
  Folding that one into `admin_roles()` would merge two decisions that only look alike.
- **Nothing in `src/` changes.** A CFO gains the authority the app already believed they had.
