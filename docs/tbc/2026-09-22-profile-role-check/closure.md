# CLOSURE — the column that decides who is an admin accepts any string

## What is true now

`update profiles set role = 'CEo'` is refused by the database. So is the insert. Before 0266 both
succeeded, and that person quietly stopped being an admin with no error at any layer — including
on the update path, which is the one `/api/team/set-role` actually uses.

## How this was found

Not by looking for it. The drift gate built an hour earlier asked which TypeScript constants
mirror a SQL set; two were declared, and the sweep had three candidates left. Checking them
instead of writing "and the rest are probably fine" produced the answer that they cannot be
declared at all — because the column they would mirror has no set.

The chain is worth keeping: a CFO who could not use admin surfaces → 47 policies with a stale role
list → a gate comparing the two remaining copies → the discovery that the column underneath them
is unconstrained. Each step was found by finishing the previous one properly rather than by a new
investigation.

## What I nearly wrote as fact

That the lowercase `member` row came from 0008's original CHECK being lowercase. It reads
`check (role in ('CEO','COO','Lead','Member'))` — mixed case. The lowercase version I had in mind
came from the enum audit's parser, which lowercases the whole file before matching. I had read a
transformation and remembered it as the migration.

The correct statement is that **the origin is unknown**, and a column with no constraint cannot
tell you how a value got into it. That is the defect, not a footnote to it.

## Residual

```json
[
  {
    "id": "R1-the-constraint-and-the-constants-still-drift",
    "item": "Adding a role to `ORG_ROLE_OPTIONS` without adding it to this CHECK produces a set-role write that passes `isAssignableOrgRole` and is rejected by the database — a 500 where a clean result belongs.",
    "why_skipped": "Closing it needs a TypeScript constant meaning 'storable in profiles.role', which nothing in the product would consume.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T17:53:06+08:00",
    "outcome": "OPENED AND THE CONFIDENCE WAS MISPLACED — it matters more than the other direction. The failure is not silent like the one 0266 fixes; it is a 500 on an admin action, which is loud but appears at the wrong layer and reads as a bug in the team page. What stops it being urgent is that adding an org role is a deliberate, rare act by someone editing `roles.ts` — and the constraint's comment is the note they will be looking at. A gate would need an exported constant nothing consumes, which is the A31 shape flagged this morning on `profile_departments` and refused there for the same reason. The honest position: a convention with a comment, not a gate, and named as such."
  },
  {
    "id": "R2-how-many-other-decision-columns-have-no-CHECK",
    "item": "`profiles.role` had none. Nothing has asked the same question of every other column whose value a policy or a gate branches on.",
    "why_skipped": "It is a real sweep and this build was a founder-approved single constraint.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T17:53:06+08:00",
    "outcome": "OPENED AND PARTLY DONE, and it corrected its own framing twice. First pass asked 'which columns do policies compare to a literal' — the answer is `status` on several tables plus `profiles.sales_coach_role`, both of which have CHECKs. Second pass listed every `status` column with no CHECK and found five, which was WRONG: three of them (`crm_invoices`, `crm_subscriptions`, `pitches`) are Postgres ENUM TYPES, constrained by the type system rather than a CHECK. My sweep assumed CHECK-or-nothing and would have reported three false positives. Genuinely unconstrained text, after the correction: **`tasks.status` and `schedule_employee.status`**. I then claimed the second one was live — `src/app/api/schedule/assistant/route.ts:76` filters `e.status === 'active'`, so a row holding `Active` would drop out of the roster silently. CHECKED THE WRITE PATH BEFORE LEAVING IT, and the claim was too strong: both writers validate with `z.enum(['active','inactive'])` (`employees/route.ts:29`, `[id]/route.ts:29`) and they are the only two. The set IS enforced, at the API boundary. The real finding is a missing LAYER — one guard, outermost, bypassed by any service-role write, dashboard edit or future second writer — not an open hole. Its weaker sibling is `employment_type`, whose comment names three values and whose validator is `z.string().max(60)`: enforced nowhere. `schedule_employee` in fact has THREE columns whose valid set lives in a trailing comment (0221:19-25), which is A30 at its most literal. Founder's call, with the corrected severity, and NOT started. The remaining boundary is every other decision column, and the search must ask three questions, not one: CHECK, enum type, or nothing."
  },
  {
    "id": "R3-the-check-had-to-be-written-in-a-particular-shape",
    "item": "`check (role is null or role in (...))` is invisible to `enum:audit`. Written that way, the column would silently never be available as a mirror subject.",
    "why_skipped": "Fixed by reordering; the general parser fix is declined in remediate.md.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T17:53:06+08:00",
    "outcome": "CLOSED FOR THIS COLUMN, OPEN AS A CONVENTION. The set count moving 105 → 106 is the proof it lands now. What remains is that the audit and the migrations have a contract nobody wrote down until this build: put `col in (...)` adjacent to the opening paren. 0239 made the same choice for a related reason. Two migrations now depend on it and the third person to write a value-set CHECK will not know. The sweep command is in remediate.md; making the parser permissive instead is refused there, with the two times that instinct has already produced a wrong parser today."
  },
  {
    "id": "R4-the-lowercase-member-row",
    "item": "One live profile holds `'member'`. The CHECK permits it so existing data does not break.",
    "why_skipped": "Removing it is a write to a real person's record — explicitly the option the founder did not choose.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T17:53:06+08:00",
    "outcome": "OPEN, by decision rather than oversight. Permitted on its own line with a comment marking it debt, so it reads as the odd one out instead of blending into the set. The uncomfortable part, stated plainly: allowing a value because it exists is how a typo becomes a supported spelling. If that row is ever normalised, `'member'` comes out of the CHECK in the same migration."
  },
  {
    "id": "R5-no-browser",
    "item": "Nothing was rendered.",
    "why_skipped": "A constraint has no surface.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T17:53:06+08:00",
    "outcome": "CLOSED. One consequence IS user-visible and is worth stating: an admin who mistypes a role in some future surface now gets an error instead of silently demoting a colleague. Nobody can see that today because no surface allows a free-text role."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Nothing in this build has a visual surface.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser.

---

## Applied, and confirmed against production

```
$ npm run db:apply
  ✅ ALL 30 invariants hold.
[db-apply] ✓ verify:live passed — structural invariants intact after the migration.

$ npm run db:dry
[db-apply] 264 migration files on disk (through 0266).
[db-apply] nothing pending — DB is up to date with supabase/migrations/.
```

**Re-counted immediately before applying**, not trusted from two hours earlier — the constraint's
permitted set was decided from a count, and a row written since would have made `ADD CONSTRAINT`
fail on the scan:

```
"admin" 10 · "Member" 9 · null 3 · "Manager" 1 · "member" 1
ALL VALUES WITHIN THE CONSTRAINT
```

Then read back from production, including the defect itself against the live constraint, inside a
transaction that was rolled back:

```
constraint present in production: true
a typo is refused: new row for relation "profiles" violates check constraint "profiles_role_check"
unchanged after rollback: "admin"=10 "Member"=9 null=3 "Manager"=1 "member"=1
```

The refused statement was `update profiles set role = 'CEo' where role = 'admin'` — the exact
shape of the failure this migration exists for, run against the real table, on real admin rows.
Before 0266 it would have succeeded and quietly removed ten people's admin authority.
