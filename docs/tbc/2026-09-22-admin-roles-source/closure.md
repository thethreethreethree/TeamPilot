# CLOSURE — one decision, forty-eight copies, one of them edited

## What is true now

A CFO is an admin in the database, the same way they have always been one in the application.

More useful than that: **the admin-role list is written down twice instead of forty-eight times.**
The next role change is one line in `roles.ts` and one in `admin_roles()`, and the forty-seven
policies follow without being touched — proved, not assumed, by an A/B that changed only the
function and watched every policy's behaviour change with it.

## The shape worth remembering

This is §2.2 at a scale the clause was not written for. It is about a consumer re-deriving a
decision the authority already made; here there was no authority at all — forty-eight equal copies
of "who is an admin", and on 2026-08-29 one of them was edited.

**The one that was edited correctly is the whole argument.** `team_invitations - insert` has the
complete four-role list. Somebody made exactly this change, got it right, and moved on. That is not
carelessness to be corrected with more care; it is what forty-eight copies do, and it proves there
will be a next time.

Not one automated check reported a problem in those 24 days, because none of them compares a
TypeScript constant to a SQL array. The gates were not failing to notice — they were not looking, and could
not have been.

## What I got wrong on the way

**I told the founder "zero of the 42 policies mention CFO". Both numbers were wrong.** It is 48
naming CEO, one of which includes CFO. I had run the count against the scratch database *while a
migration audit was concurrently dropping and rebuilding it* — reading a schema mid-construction
without noticing, because a partial answer to a counting query looks exactly like a complete one.

The correction made the case stronger rather than weaker, which is the uncomfortable part: the
version I reported first was both wrong and less useful.

## Residual

```json
[
  {
    "id": "R1-the-function-is-inlined-by-the-planner",
    "item": "`admin_roles()` is a STABLE SQL function returning a constant array. Postgres is free to inline it into each policy's plan, which could make the single source an illusion — policies carrying a folded copy of the list from the moment they were created.",
    "why_skipped": "Postgres tracks plan dependencies on functions and invalidates cached plans when a function is replaced.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T14:17:47+08:00",
    "outcome": "OPENED AND MEASURED, and it is the most valuable thing in this build. Rather than reason about planner behaviour, the probe changed ONLY the function — `create or replace admin_roles()` back to the old three-role list — and re-ran the identical insert as the identical CFO. Refused: `new row violates row-level security policy for table \"departments\"`, cfo_created_with_old_list = 0. Inlining may well happen; what matters is that the invalidation works, and now that is a result rather than a belief. This is the test I would keep if I could keep only one."
  },
  {
    "id": "R2-two-authorities-remain",
    "item": "48 copies became 2: ADMIN_ROLES in src/lib/roles.ts and admin_roles() in the database. Nothing compares them.",
    "why_skipped": "The gate that would close it is an extension of `enum:audit` (declared TypeScript mirror vs a SQL source), and building it in this commit would mean its first run happens against a state it helped create.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T14:17:47+08:00",
    "outcome": "OPEN, and it is the next build. The same drift is still possible — edit the constant, not the function — and would be exactly as silent, just 47 times smaller. The original took 24 days to surface and only by accident. Carried with its sweep command in remediate.md."
  },
  {
    "id": "R3-generated-from-a-replay-not-from-production",
    "item": "The 47 policies were re-emitted from `migration_audit_scratch`, a database built by replaying the migration history — not from production.",
    "why_skipped": "It is not skipped. It was the risk most likely to do real damage and it was settled before anything was applied.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T14:17:47+08:00",
    "outcome": "CLOSED BY COMPARISON. Live and scratch agree on the policy count (322), the matching count (47), the command distribution (18/11/8/8/2), permissiveness and grantee — and, decisively, on a byte comparison of all 47 definitions rebuilt into the same DDL shape: 21343 characters each, IDENTICAL. Production has not drifted from the history. Worth noting what the first two checks were worth on their own: nothing. Two sets of 47 can agree on every count and differ in the SQL."
  },
  {
    "id": "R4-the-app-side-is-untested-for-CFO",
    "item": "No test asserts that a CFO reaches an admin surface. `isAdminRole` has always returned true for CFO, so the application half of this was never broken — but it is also never exercised.",
    "why_skipped": "Nothing changed in `src/`, so a test added here would pin behaviour this build did not touch.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T14:17:47+08:00",
    "outcome": "OPEN, and smaller than it looks. `isAdminRole` is a one-line `includes` over ADMIN_ROLES and is covered for the list as a whole. What is untested is the end-to-end claim — invite a CFO, reach an admin surface, complete an admin write — which needs the route-level database harness that 0264 and the Files build both named as their own residual. Three builds now want the same missing thing."
  },
  {
    "id": "R5-no-browser",
    "item": "Nothing was rendered.",
    "why_skipped": "No surface changed.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T14:17:47+08:00",
    "outcome": "CLOSED, and it is the first build today where that is honest rather than an omission. A migration that rewrites RLS policies has no pixels. The twenty-two consecutive jsdom builds behind it still stand."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this build. Nothing in this build has a visual surface at all.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser.

---

## A detail found while the gate ran, and it sharpens the whole thing

`src/lib/roles.ts` opens by explaining why it exists:

> Before this module the role space was authored in ≥4 incompatible places (audit 2026-07-10,
> finding F4): the invite flow's local `ROLES`, auth-helpers' `ADMIN_ROLES`, the onboarding RPC's
> `'admin'`, and inline `role === 'CEO' || 'COO' || 'admin'` at ~20 gates. **This module authors
> each set ONCE, by category, so a change happens in one place.**

**That module was built to fix this exact class, ten weeks ago.** It fixed it in TypeScript. The
~20 inline gates it consolidated were app-side; the 47 in the database were never in scope, and the
promise — *a change happens in one place* — has been true within `src/` and false across the
language boundary ever since.

So this is not a new lesson. It is the same audit finding (F4, 2026-07-10) reaching the half of the
system that nobody swept, and then producing a real drift seven weeks after the "fix". A26 says a
reported bug is one instance of a class and the fix is incomplete until the class is swept to its
**codebase-wide** boundary; the 2026-07-10 sweep stopped at the edge of `src/`, and a boundary
drawn at a language is not a codebase-wide boundary.

One more thing, small and telling. The same docblock still says:

> `ADMIN_ROLES`: which role values grant company-admin authority. Covers BOTH the onboarding
> `'admin'` AND the invitable `'CEO'`/`'COO'`.

**It does not mention CFO.** The array was widened on 2026-08-29 and the sentence describing it was
not — the drift happened *inside one file*, between a constant and the comment above it, before it
ever reached the database. Left as found rather than tidied: it is evidence, and correcting it here
would remove the only trace that the 2026-08-29 edit was made in a hurry.

---

## Applied, and confirmed against production

```
$ npm run db:apply
  ✅ ALL 30 invariants hold.
[db-apply] ✓ verify:live passed — structural invariants intact after the migration.

$ npm run db:dry
[db-apply] 263 migration files on disk (through 0265).
[db-apply] nothing pending — DB is up to date with supabase/migrations/.
```

Then read back from production itself, not inferred from the apply succeeding:

```
admin_roles() = [ 'CEO', 'CFO', 'COO', 'admin' ]
policies calling admin_roles(): 47 | still literal: 0 | total: 322
```

Three-two-two, the same number it has been all along. Forty-seven policies changed what they
consult and not one changed what it decides — except for the CFO, which is the point.

The 30 invariants that ran after the apply include the ones this migration could plausibly have
broken: tenant isolation (no `company_id` table with a permissive write policy), every finance
`company_id` table affirmatively company-scoped, the Macro-Mode per-rep owner restriction, and
`pilot_codes` still RLS-sealed. That is the check I would want if I could only have one after
rewriting 47 policies, and it passed on the live database rather than a replay of it.
