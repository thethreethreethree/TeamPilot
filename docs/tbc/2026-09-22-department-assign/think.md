---
started_at: 2026-09-22T17:59:13+08:00
trigger: Founder ruling — finish the people-into-departments capability rather than delete it. Three exports exist with zero callers, so `profile_departments` is permanently empty and `autoRoute`'s rule R3 can never fire.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — a capability with a read, two writers, and no door

## What exists and what does not

Found this morning while checking RLS before an unrelated build:

| | |
|---|---|
| `profile_departments` table, with a dedupe key and cascade deletes | exists |
| RLS: SELECT company-wide, INSERT/DELETE admin-only, both tenant-joined | exists |
| `listProfileDepartments`, `assignUserToDepartment`, `removeUserFromDepartment` | exist |
| **any surface that calls them** | **none** |

So the table is permanently empty, and `autoRoute.ts:332` has a rule that reads it:

```ts
// Rule 3 — Uploader department fallback.
if (departmentIds.size === 0 && ctx.uploaderId) {
  const uploaderDepts = await getUploaderDepartments(ctx.uploaderId);
  …
  if (uploaderDepts.length > 0) ruleTrace.push(`R3:uploader-dept-fallback=${uploaderDepts.length}`);
}
```

**R3 can never fire**, and its non-firing is invisible by construction: the trace records R3 only
when it matched, so a trace without an R3 line reads as "not needed" rather than "inert".

This is A31 — schema-complete is not built — and the reason `writer:audit` passes it is worth
keeping: the table HAS writers. It does not ask whether a writer is *reachable*, and a writer
nothing calls is the same fact as no writer, dressed as compliance.

## Where the surface belongs

The team page, on the member row, beside the org-role control. Everything the row needs is already
there: `MemberRow` has `amAdmin`, the member's id and name, and the pattern for an admin-only
control that posts and refreshes (`setOrgRole`).

Not a new page. A department is an attribute of a person, and the place a person's attributes are
edited is the row that already edits them.

## The decision the RLS already made

`profile_departments_insert_admin` and `_delete_admin` both require the actor to be an admin *of
the target's company*. That is the authority check, in the database, already correct — and after
0265 it reads `admin_roles()`, so a CFO can do this too.

So the route consumes that verdict rather than re-deriving it (§2.2): it uses the **RLS-bound
client**, and a non-admin's write is refused by the policy rather than by a second copy of the
rule in TypeScript. The one thing the route must add is the tenant check the policy cannot make on
its own behalf — that the member being edited is in the caller's company — because a 404 there is
a better answer than a policy refusal that leaks whether the id exists.

## The shape

- `GET /api/team/departments` → every assignment in the caller's company, so the page reads once
  rather than per member.
- `POST /api/team/departments { memberId, departmentIds }` → diff against current, then
  `assignUserToDepartment` for the additions and `removeUserFromDepartment` for the removals.

A diff, not a replace-all, because the writers are per-row and because `assigned_by` is a real
column recording who did it — rewriting every row on every save would falsify that for the ones
that did not change.

## What could go wrong, before I look

1. **A partial save reported as success.** Several inserts and deletes, each returning a boolean.
   If one fails the member ends up in a state neither the user nor the page believes in.
2. **`listProfileDepartments` returns `null` on a failed read** — changed this morning, for exactly
   this reason. The route and the surface must distinguish that from "this person is in no
   department", or the control will offer to add someone to a department they are already in.
3. **The wire-shape crash, a fifth time today.** A new field on the team page's response.
4. **Re-deriving the admin rule in TypeScript** and having it drift from the policy — the §2.2
   failure this session has now seen twice.
5. **A control that renders for a non-admin** and fails on save. The row already knows `amAdmin`;
   the question is whether a non-admin sees the assignments read-only or not at all.
6. **R3 still not firing after all this**, because nothing verifies the loop closes. The build is
   not done when the surface saves; it is done when an upload routes by the uploader's department.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The problem is not 'departments cannot be assigned'. It is that a rule in an unrelated module silently depends on an empty table, and the fix is only complete when that rule can fire." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "Methodology in the tree at the moment of action.",
    "how_this_build_will_embody_it": "All fourteen opened at their line ranges in the command immediately before this file." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "Four layers, foundation up, and layer 3 is whether the feature leaves the surrounding workflow intact.",
    "how_this_build_will_embody_it": "Layer 3 is the whole point and the reason this is not just a form. Assigning a department has no visible effect on the team page; its effect is that a file uploaded later routes somewhere. A build that saves and stops has passed layer 2 and failed layer 3." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "THINK first, then search.",
    "how_this_build_will_embody_it": "The risks above were written before the code, and risk 6 is the one that decides whether this build is finished." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-320", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "Consume the verdict, do not re-derive the gate.",
    "how_this_build_will_embody_it": "The RLS policy already decides who may assign. The route uses the caller-scoped client so that decision is made once, in the database, and after 0265 it reads `admin_roles()` — so this surface gained CFO support without a line being written for it." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "Append-only; state derived rather than edited.",
    "how_this_build_will_embody_it": "A diff, not a replace-all. `assigned_by` and `assigned_at` record who put someone in a department and when; rewriting every row on every save would falsify both for the rows that did not change." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "Distrust the confident answer.",
    "how_this_build_will_embody_it": "The confident answer is that a save returning ok means the capability works. R3 firing is the claim that matters, and it is a different claim." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "The checklist; 5a asks whether the user is left in a flowing state.",
    "how_this_build_will_embody_it": "5a: after assigning, nothing on screen changes except the row. The honest answer is to say what the assignment DOES — route this person's uploads — rather than leave an unexplained control." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "Having the label without the content.",
    "how_this_build_will_embody_it": "R3 is quoted from `autoRoute.ts:332` as it reads today, including the line that makes its silence invisible." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "Opened in one command, timestamped either side." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-696", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "One instance of a class; sweep to the boundary.",
    "how_this_build_will_embody_it": "The class is a writer nothing calls. The boundary question — how many other tables have unreachable writers — is what `writer:audit` cannot answer, and it goes in the residual rather than being claimed as covered." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "Gate the class; a gate must be precise or not exist.",
    "how_this_build_will_embody_it": "Why no export-level reachability audit is being built alongside this. The obvious version fires on every helper exported for a test, and an imprecise gate is worse than none — refused this morning for the same reason." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-798", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "Schema-complete is not built; the seam between database and surface is where a correct system silently becomes a nonexistent feature.",
    "how_this_build_will_embody_it": "The canonical instance, and the one A31 was captured from: seven features reported BUILT whose columns nothing could write. This closes one of the same shape." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-22T17:59:13+08:00",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code, render tests for the control, and — the one that decides whether this is finished — a probe that R3 fires once a person is in a department." }
]
```
