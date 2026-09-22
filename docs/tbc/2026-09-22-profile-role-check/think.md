---
started_at: 2026-09-22T17:50:55+08:00
trigger: Finishing the drift-gate sweep turned up that `profiles.role` — the column deciding company-admin authority — has no CHECK constraint at all. Founder ruling: add one allowing what is already there.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the column that decides who is an admin accepts any string

## What is wrong

`profiles.role` has **no CHECK constraint**. Confirmed against the database: the only role-ish
constraint on that table is `profiles_sales_coach_role_check`, and a search for one naming `role`
returns 0.

`admin_roles()` compares against that column. So the failure is:

> Store `role = 'CEo'` and that person is not an admin. No error, at any layer.

The direction is the safe one — a typo **removes** authority rather than granting it — and it is
completely silent. The person sees the product without its admin surfaces and has no way to tell
that from a permissions decision someone made about them.

Nothing in the drift gate built an hour ago can see it either, because there is no set to compare
a constant against. That is how this was found: the sweep for "which constants mirror a SQL set"
ran out of subjects, and the reason was that the column has no set.

## What is actually storable, from the record rather than from assumption

Three writers, all read this session:

| Writer | What it can put there |
|---|---|
| `/api/team/set-role` | the 8 assignable roles, validated by `isAssignableOrgRole` |
| invite acceptance (`0008:154`) | the invitation's role — constrained to the 9 by `team_invitations_role_check` |
| onboarding RPC (`0046`/`0047`) | `'admin'`, hard-coded |

So the reachable set is the 9 invitable roles plus `admin`.

And production, counted (24 profiles, no names, founder-approved):

```
"admin"   10      "Member"  9      null  3      "Manager"  1      "member"  1
```

`"member"` — lowercase — is the one that does not fit. **Its origin is unknown, and I am not
going to guess.** My first explanation was that 0008's CHECK had been lowercase; opening 0008
shows `check (role in ('CEO','COO','Lead','Member'))`, mixed case. The earlier reading that said
otherwise came from the enum audit's parser, which lowercases the whole file — I had read a
transformation, not the migration.

The honest statement is that a column with no constraint cannot tell you how a value got there,
and that is the defect, not a footnote to it.

## The shape

```sql
check (role is null or role in (<the 9>, 'admin', 'member'))
```

- **The 9 + `admin`** because those are reachable through a writer today.
- **`member`** because one live row holds it, and a constraint that breaks existing data is not a
  constraint, it is an outage.
- **NULL permitted** because 3 live rows are null and nothing in the product treats a missing role
  as invalid — `isAdminRole(null)` is false and `orgRoleRank(null)` sorts last, both deliberately.

What it deliberately does NOT allow: the other pre-0239 spellings. No row holds them. If one
appears, a rejected write is how we find out, which is the whole point.

## What could go wrong, before I look

1. **A constraint that rejects existing data**, turning a safety improvement into an outage on the
   next write to an old row. The count above is the guard, and it must be re-run against live
   before the apply rather than trusted from thirty minutes ago.
2. **Locking `profiles` while validating.** `ADD CONSTRAINT ... CHECK` takes an ACCESS EXCLUSIVE
   lock and scans the table. 24 rows makes this irrelevant here; writing it down because the same
   statement on a large table is a different event entirely.
3. **Inventing a TypeScript constant purely to be mirrored.** The gate would then have a third
   subject — which was half the appeal — but an exported constant nothing consumes is exactly the
   A31 shape I flagged this morning. The gate is not worth an unused export.
4. **`member` becoming permanent.** Allowing it is correct today and is also how a typo becomes a
   supported value. It needs to be named as debt, not quietly blessed.
5. **A later role being added to `ORG_ROLE_OPTIONS` and not here** — the same drift, in a new
   place, on the day this lands.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T17:50:55+08:00",
    "why_it_governs": "Understanding precedes solving; the problem must be understood from the record.",
    "how_this_build_will_embody_it": "The valid set comes from three writers read in the source and one count against production, not from what a role column ought to contain. The one value that does not fit is recorded as unexplained rather than given a plausible story." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T17:50:55+08:00",
    "why_it_governs": "The methodology must be in the tree at the moment of action.",
    "how_this_build_will_embody_it": "All fourteen clauses opened at their line ranges in the command immediately before this file." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-22T17:50:55+08:00",
    "why_it_governs": "Four layers, foundation up; a problem at a lower layer propagates to every layer above it.",
    "how_this_build_will_embody_it": "Layer 1, and the clearest case of propagation in the session: an unconstrained column at the bottom means a typo reaches the top as an invisible loss of authority. Nothing above can catch it, because nothing above knows what a valid role is." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-22T17:50:55+08:00",
    "why_it_governs": "THINK first, then search; audit while working rather than when asked.",
    "how_this_build_will_embody_it": "This was found by finishing a sweep that had already produced its answer. The temptation was to stop at 'ADMIN_ROLES and INVITABLE_ROLES are declared, done'." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-320", "read_at": "2026-09-22T17:50:55+08:00",
    "why_it_governs": "One source for a decision; duplicated conditions drift.",
    "how_this_build_will_embody_it": "In the negative. The valid-role set currently has ZERO authorities in the database and several partial ones in TypeScript — `ASSIGNABLE_ORG_ROLES` (8), `INVITABLE_ROLES` (9), `ADMIN_ROLES` (4) — each correct about its own question and none about storability." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T17:50:55+08:00",
    "why_it_governs": "Append-only; history intact.",
    "how_this_build_will_embody_it": "No data is rewritten. The lowercase `member` row stays exactly as it is and the constraint is written to accommodate it — the alternative, normalising it first, is a write to a real person's row and was explicitly the option the founder did not pick." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-22T17:50:55+08:00",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "The confident answer was that lowercase `member` came from 0008's CHECK. 0008 says `('CEO','COO','Lead','Member')`. I had been reading the enum audit's lowercased parse and mistook it for the file." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T17:50:55+08:00",
    "why_it_governs": "The checklist; item 4 asks whether a constraint is real or incidental.",
    "how_this_build_will_embody_it": "Item 4 twice: the live `member` row is a REAL constraint on what the CHECK may say, and the absence of a TypeScript constant for storable roles is an incidental one — which is why no constant is being invented to satisfy the gate." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-22T17:50:56+08:00",
    "why_it_governs": "Having the label without the content — citing an asset never opened.",
    "how_this_build_will_embody_it": "0008's CHECK is quoted from line 46 of the migration, after the first version of this document quoted it wrongly from a parser's output." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-22T17:50:56+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "Opened in one command, timestamped from the clock either side." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-696", "read_at": "2026-09-22T17:50:56+08:00",
    "why_it_governs": "A reported bug is one instance of a class; sweep to the codebase-wide boundary.",
    "how_this_build_will_embody_it": "The boundary question this raises is larger than this build answers: how many other columns carrying a decision have no CHECK? Named in the residual rather than pretended away." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-22T17:50:56+08:00",
    "why_it_governs": "Gate the class; a gate must be precise or not exist.",
    "how_this_build_will_embody_it": "A CHECK constraint IS the gate here — it fails the write, at the layer that knows, without anyone's cooperation. That is the strongest form A30 asks for, and it is available precisely because the thing being gated is a value in a column." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-798", "read_at": "2026-09-22T17:50:56+08:00",
    "why_it_governs": "Schema-complete is not built; and its sibling — something declared that nothing consumes.",
    "how_this_build_will_embody_it": "Why no `STORABLE_PROFILE_ROLES` constant is being added. It would exist only to be read by an audit, which is an export nothing in the product consumes — the shape I flagged this morning in `profile_departments`." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-22T17:50:56+08:00",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code, the constraint applied to the scratch database with a probe that a bad value is refused and every live value accepted, and a re-count against production immediately before the apply." }
]
```
