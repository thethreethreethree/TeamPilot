# CLOSURE — two is better than forty-eight and it is still two

## What is true now

The admin-role list is written down twice and **a gate compares them**. Dropping `"CFO"` from
`ADMIN_ROLES`, or adding a role the database has never heard of, fails `npm run check`.

That is the A30 terminal step for the CFO incident. 0265 fixed the instance — 48 copies to 2 — and
left a prose promise in its own `remediate.md` that the remaining two could still part company.
This is the gate, and it fires on the exact drift, in both directions, without anyone remembering
to look.

And a second mirror came with it, which was not the plan: `INVITABLE_ROLES` is now declared against
the `team_invitations.role` CHECK.

## The order was the point

The gate's first run is against 0265 **as it stands**, not against a state it helped create. Had
both landed in one commit, a passing run would have proved only that two things written in the same
sitting agree with each other.

## What I got wrong, inside the audit itself

The parser I wrote to catch "a decision written down twice" had the defect that audit exists to
catch: it read something other than what was there, and reported success while doing it. Three of
the four sources it found on the real corpus were arrays from unrelated statements.

It reported success because nothing had declared those keys. **The opt-in design contained a bug it
could not prevent** — a good property, and not a substitute for the parser being right. What found
it was printing the extracted pairs against the real migrations. No verdict would have.

The same file already records the same class in its own history: a line-by-line scanner that read a
seven-value CHECK as two. Twice now, in one audit, the parse has been the thing that was wrong.

## The thing I nearly wrote down without checking

The residual below began life as *"`ADMIN_ROLES` is the only two-authority list, so this gate has
one subject"*. Before writing it I went looking for a second, and found that `INVITABLE_ROLES`
mirrors a CHECK and was not declared to this audit — a `table.column` case for the OLDER marker,
which has existed since this morning and was never pointed at it.

Following that produced two things the build would not otherwise have:

1. **The case bug.** Declaring it immediately reported all nine values as both missing and not in
   the database, because the CHECK half lowercased its values while the mirror half did not. Eight
   snake_case mirrors had hidden it perfectly.
2. **A better guard than the one that was there.** `enumConstraintSync.test.ts` already pins
   `INVITABLE_ROLES`, but it reads the CHECK from migration **0239 by filename prefix**, and its
   own comment says: *"REPIN this prefix if a later migration re-alters team_invitations.role."*
   That is a lesson recorded in prose, waiting for someone to remember. The marker walks every
   migration and takes the last definition, so a re-alter is picked up with no manual step.

A residual written from the first confident sentence would have been wrong, and the two findings
behind it would still be in the code.

## Residual

```json
[
  {
    "id": "R1-how-many-lists-have-two-authorities",
    "item": "Two mirrors are declared now. Nobody has swept `roles.ts` — or the rest of `src/` — for every constant that mirrors something in SQL.",
    "why_skipped": "Declaring a mirror is a judgement about intent per constant, not a bulk edit. `ORG_ROLE_OPTIONS`, `ASSIGNABLE_ORG_ROLES` and `ROLE_TIER` all hold role values, and whether each is MEANT to equal a database set is a different question for each.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T14:35:11+08:00",
    "outcome": "OPENED, AND IT CHANGED THE BUILD. This entry was going to say 'ADMIN_ROLES is the only one'. Looking instead of asserting found INVITABLE_ROLES undeclared, which found the case bug, which found that its existing guard is pinned to a migration by filename. Three things, from declining to write one confident sentence. Then the remaining three were checked rather than left open, and the answer is that they CANNOT be declared: `profiles.role` has no CHECK constraint at all. Confirmed against the database — the only role-ish constraint on that table is `profiles_sales_coach_role_check`, and a search for one naming `role` returns 0. So `ORG_ROLE_OPTIONS`, `ASSIGNABLE_ORG_ROLES` and `ROLE_TIER` describe a free-text column; there is nothing to mirror. That is the honest end of the sweep, and it surfaced something larger — see R6."
  },
  {
    "id": "R6-profiles-role-is-free-text",
    "item": "`profiles.role` — the column that decides company-admin authority — has NO CHECK constraint. `admin_roles()` compares against it, so any string is storable and anything not in the list is simply not an admin.",
    "why_skipped": "Adding a CHECK is a migration and a decision about the valid set, and the live data already contains both `Member` and `member`, so a constraint would need the data normalised first or both spellings allowed.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T14:35:11+08:00",
    "outcome": "OPEN, and found by finishing a sweep rather than by looking for it. The direction of failure is the safe one — a typo REMOVES authority rather than granting it — but it fails silently: store `role = 'CEo'` and that person loses every admin surface with no error at any layer, and nothing in this audit can see it because there is no set to compare against. A CHECK would fix it AND make the column a third subject for this very gate. It needs the founder: the valid set has to include whatever is already in production (admin, Member, member, Manager, and 3 nulls, from today’s count), or that data gets normalised first. Not started."
  },
  {
    "id": "R2-the-parse-is-the-weak-point-and-always-will-be",
    "item": "A static parser's failure mode is a verdict shaped like a correct one. This audit has now had two parse bugs: a line-scanner that saw 2 of 7 CHECK values, and a function matcher that read past the body.",
    "why_skipped": "Not skipped — it is the finding, and it is structural rather than fixable.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T14:35:11+08:00",
    "outcome": "OPEN, permanently. Twenty tests pin the cases that are known; nothing pins the cases that are not, and no test can, because the symptom of a mis-parse is silence. The practice that found both bugs is the same — print what the parser extracted, against the real corpus, and read it. That is a habit and cannot be gated, which is exactly the thing A30 says will return. Written here so whoever extends this audit next does the printing before trusting the verdict."
  },
  {
    "id": "R3-a-non-literal-list-cannot-be-read",
    "item": "A function returning `enum_range(...)`, a table lookup or a `case` is not parsed; a marker on one fails as 'no function named X returning a value list exists'.",
    "why_skipped": "More parsing is more surface for R2. The failure message is honest and points at the fix — write the list as a literal.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T14:35:11+08:00",
    "outcome": "DECLINED, with the condition for revisiting stated: a real case where the list genuinely cannot be a literal. `admin_roles()` is a literal because that is what a mirror should be. Speculatively supporting three more shapes would trade a clear failure for a parser with three more ways to be confidently wrong."
  },
  {
    "id": "R4-two-guards-on-one-list-now",
    "item": "`INVITABLE_ROLES` is pinned by both `enumConstraintSync.test.ts` and this audit's marker.",
    "why_skipped": "Removing the older one was not in this build's scope and deleting a working guard to tidy up is how coverage disappears.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T14:35:11+08:00",
    "outcome": "OPEN, deliberately, and not a duplication worth collapsing yet. They fail differently: the test also checks the zod enums in `validate.ts` against their columns, which this audit does not look at; the marker survives a later re-alter of the CHECK, which the test does not. The overlap is one list. If the older test's other pairs ever move to markers, that is the moment to retire it — not before."
  },
  {
    "id": "R5-no-browser-no-database",
    "item": "Static analysis over files only.",
    "why_skipped": "Nothing renders and nothing queries.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T14:35:11+08:00",
    "outcome": "CLOSED. The SQL half of the claim this gate enforces was exercised against real Postgres in the 0265 build, including a behavioural probe of the function it now watches."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Nothing in this build has a visual surface.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser.
