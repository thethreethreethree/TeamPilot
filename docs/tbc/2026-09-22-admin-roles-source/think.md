---
started_at: 2026-09-22T14:16:03+08:00
trigger: Checking the RLS on `profile_departments` before building a department-assignment surface. The policy allows CEO/COO/admin. `ADMIN_ROLES` in the app says CEO/CFO/COO/admin. A CFO is an admin everywhere in the application and an admin nowhere in the database.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — one decision, forty-eight copies, one of them edited

## What is actually wrong

```ts
// src/lib/roles.ts:39
export const ADMIN_ROLES = ["CEO", "CFO", "COO", "admin"] as const;
```

```sql
-- 47 policies, across 36 tables
profiles.role = ANY (ARRAY['CEO'::text, 'COO'::text, 'admin'::text])
```

`isAdminRole("CFO")` is **true**, so every admin surface renders for a CFO and every route gated on
`ctx.isAdmin` lets them through. The database refuses them on every RLS-gated admin write. `CFO` is
in `INVITABLE_ROLES` and in `ORG_ROLE_OPTIONS` with tier "C-Suite", so that account can be created
from the team page today.

The failure would be silent and **misattributed**: the control is there, the click does nothing,
and it reads as a broken feature rather than as a role that was never granted. Worse, it would be
inconsistent — a route using `createAdminClient()` bypasses RLS, so `/api/team/set-role` works for
a CFO while `profile_departments` would not. The same person's authority depends on which client a
route happened to pick.

## Latent, not live — checked before writing anything

Founder-approved production read, counts only:

```
admin 10 · Member 9 · (null) 3 · Manager 1 · member 1 — 24 profiles
```

**No CFO exists.** Nobody is standing in it. That lowers the urgency and changes nothing about the
fix: the trap is one invite away.

Two things the same count showed, checked rather than assumed. `Member`/`member` differ in case and
it does not matter — `orgRoleRank` lowercases before its lookup, so both rank Frontline; and
`isAdminRole` is exact, but every live admin row is lowercase `admin`, which is the value in
`ADMIN_ROLES`. Three null-role profiles see no admin surface.

## Where it came from, and why that is the argument

`roles.ts` records it: *"'CFO' added 2026-08-29 with the org hierarchy (founder: C-Suite = admin)"*.

**One policy was updated that day and got it right.** `team_invitations - insert` carries two arrays
doing two different jobs, and its who-may-invite list is the complete four:

```sql
role <> ALL (ARRAY['CEO','CFO','COO'])                         -- inviting a non-C-Suite role
OR EXISTS (SELECT 1 FROM profiles p
           WHERE p.id = auth.uid()
             AND p.role = ANY (ARRAY['CEO','CFO','COO','admin']))
```

The other 47 copies of the same decision did not move. That is not carelessness. It is what
forty-eight copies of one decision do, and it is the whole case for a single source: someone
already made this exact edit correctly once, which proves there will be a next time.

## The shape, and one deviation from the option as I first worded it

The founder chose "one `is_company_admin()`, the policies call it". Reading the 47 changed my mind
about **where the seam belongs**, and the deviation belongs in the record before the build.

All 47 share the identical literal. The predicate AROUND it varies:

```sql
EXISTS (SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.company_id = <this table>.company_id      -- ← varies
          AND profiles.role = ANY (ARRAY[...]))
```

and `profile_departments` joins `profiles me` to `profiles target` on `me.company_id =
target.company_id`, because the row has no `company_id` of its own.

So `is_company_admin(company uuid)` would unify **two** things: the admin-role list, which drifted,
and the tenant-scope expression, which did not. **The tenant scope is the tenant boundary.**
Hand-rewriting 47 of them is exactly where a cross-tenant read gets introduced — which is the
incident A30 was captured from, 19 views missing `security_invoker`, one of them exposing every
tenant's taxpayer IDs.

`admin_roles()` returning the list, with one exact-literal substitution per policy, delivers the
property the founder asked for (the next role change is one line) and leaves every tenant check
byte-for-byte as written.

## What could go wrong, before I look

1. **The migration is generated from the SCRATCH database.** If production's policies have drifted
   from the replayed migration history, applying this would silently reset them — and because the
   file is generated, that diff would never appear in review. This is the one that would do real
   damage, and it has to be settled by comparison, not by assumption.
2. **`rls:audit` losing sight of 47 policies.** Its parser wants `for <op>` adjacent to the table
   name; any extra clause in between and the audit reports 36 tables as having lost coverage on a
   migration that changed none.
3. **A behavioural probe that proves the opposite of what it measures.** Impersonation in Postgres
   depends on which setting `auth.uid()` reads. Get it wrong, `auth.uid()` is null, every policy
   denies, and the probe "confirms" a CFO is refused.
4. **INVARIANT 4**, which gates a client-callable `SECURITY DEFINER` function taking a tenant
   parameter.
5. **A window with no policy on a live table.** Drop-then-create is only safe inside one
   transaction.
6. **Function volatility.** `IMMUTABLE` would license the planner to fold the list at plan time —
   and the entire point of this function is that its definition changes again.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T14:16:09+08:00",
    "why_it_governs": "Understanding precedes solving; the problem must be understood from the record before a fix is permitted.",
    "how_this_build_will_embody_it": "The understanding that changed the design is that ONE policy was already updated correctly. Without finding that, this reads as sloppiness and the fix is 'add CFO to 47 arrays'. With it, the fix is a single source, because the same edit will be needed again." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T14:16:09+08:00",
    "why_it_governs": "The methodology must be in the tree at the moment of action.",
    "how_this_build_will_embody_it": "Both documents are in the tree and hashed above; all fourteen clauses below were opened at their line ranges immediately before this document was written." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-22T14:16:09+08:00",
    "why_it_governs": "Four layers, foundation up. Layer 1 is whether the system stays maintainable after this ships.",
    "how_this_build_will_embody_it": "This is a pure layer-1 change — no surface, no user-visible behaviour today, and its entire value is what it prevents at the next role change. The layer-2 consequence it removes is a CFO clicking admin controls that silently do nothing." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-22T14:16:09+08:00",
    "why_it_governs": "THINK first about what could fail, then search; the agent audits as it works.",
    "how_this_build_will_embody_it": "Nobody reported this. It came from reading one table's RLS before building an unrelated surface, and asking why the list looked shorter than the constant I had read an hour earlier." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-320", "read_at": "2026-09-22T14:16:09+08:00",
    "why_it_governs": "Consume the verdict, never re-derive it. Duplicated conditions drift: a term added to one copy and not the other silently defeats the gate, with every automated check green.",
    "how_this_build_will_embody_it": "This is the clause, at a scale it was not written for. Forty-eight copies of 'who is an admin', one term added to one copy on 2026-08-29. Every automated check has been green throughout, because there is no check that compares a TypeScript constant to a SQL array." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T14:16:09+08:00",
    "why_it_governs": "Append-only; history intact.",
    "how_this_build_will_embody_it": "Forward-only, like every migration here. The 47 policies are dropped and re-created inside one transaction rather than altered, and no earlier migration is edited — 0265 is a new statement of the same intent." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-22T14:16:09+08:00",
    "why_it_governs": "Distrust the confident answer that arrived too quickly. The biggest risk is the builder under pressure.",
    "how_this_build_will_embody_it": "The confident answer was 'zero of the 42 policies mention CFO', which I reported to the founder and which was wrong twice over — I had queried the scratch database while a migration audit was rebuilding it. A partial answer to a counting query looks exactly like a complete one." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T14:16:09+08:00",
    "why_it_governs": "The pre-action checklist; item 4 asks whether a constraint is real or incidental.",
    "how_this_build_will_embody_it": "Item 4 decided the shape. The tenant-scope expression varying per policy is a REAL constraint — it is the tenant boundary — so the design goes around it rather than through it. The role array being written out 47 times is incidental, and that is the part that moves." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-22T14:16:10+08:00",
    "why_it_governs": "Labels without content — citing an asset never opened.",
    "how_this_build_will_embody_it": "A30's triggering incident is quoted below from the paragraph as it reads today, including the detail that makes it bite: `fin_1099_worksheet` and the taxpayer IDs." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-22T14:16:10+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "All fourteen were opened in one command immediately before this file was written, after the gate refused an earlier build today for citing reads that predated its own start." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-696", "read_at": "2026-09-22T14:16:10+08:00",
    "why_it_governs": "A reported bug is one instance of a class; the fix is incomplete until the class is swept to its codebase-wide boundary.",
    "how_this_build_will_embody_it": "The boundary is the whole schema, and it was swept before the fix: 48 policies naming CEO, 1 with CFO, 47 without. The sweep is also what found the one correct policy, which is the fact the design rests on." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-22T14:16:10+08:00",
    "why_it_governs": "Gate the class; a gate must be precise or not exist. Its own incident is 19 views that read across the tenant boundary.",
    "how_this_build_will_embody_it": "Twice. It is why the seam is the role array and NOT the tenant-scope expression — 47 hand-rewritten tenant checks is the same shape as 19 hand-written views. And the remaining gap, that nothing compares ADMIN_ROLES to the SQL list, is named in the closure rather than claimed as closed." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-798", "read_at": "2026-09-22T14:16:10+08:00",
    "why_it_governs": "Schema-complete is not built; the seam between database and surface is where a correct system silently becomes a nonexistent feature.",
    "how_this_build_will_embody_it": "The mirror image of A31, and worth naming as such. A31 is a surface that cannot work because the database never gets written. This is a ROLE that cannot work because the database never agreed it existed — both are a seam where each side is individually correct." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-22T14:16:10+08:00",
    "why_it_governs": "\"Verified\" is a claim about a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code on its own line, a byte-level comparison of all 47 live definitions against the generated ones, and a behavioural probe that impersonates a CFO through the same setting `auth.uid()` actually reads." }
]
```
