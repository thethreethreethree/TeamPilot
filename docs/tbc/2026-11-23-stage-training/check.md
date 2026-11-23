# CHECK - Training by deal stage

## Commands

```
npx vitest run src/lib/coach/remote/__tests__/stageTraining.test.ts src/app/api/coach/remote/stage-practice → 13 passed, exit 0
npx vitest run src/app/api/coach/remote/scenarios/stages → 5 passed, exit 0
mutation: ownership check removed in POST stage-practice → 1 failed | 7 passed; restored
npx tsc --noEmit -p . → exit 0
```

PGlite replay of 0310 (twice, re-runnable) on the repo's Supabase shim with 0309:

```
key: demo booked
bad key: refused
current: [{"stage_key":"demo","stage_label":"Demo"}]          (Negotiation tagged then untagged → absent)
after update+delete rows: { n: 3, on_n: 2 }                     (update and delete ignored)
member, no MFA : 1 · member, MFA aal1: 0 · other company: 0
exit 0
```

Production:

```
npm run db:apply → ✅ ALL 32 invariants hold · verify:live passed (exit 0)
npm run db:apply (again) → 308 migration files on disk (through 0310) · nothing pending
✓ PASS  multi-factor sign-in holds in the database: every table that grants access has the mfa_required policy (0309)
```

## Findings

### F1 - the training screen showed a failed read as "No scenarios yet"
class: failed read rendered as an empty state (the class swept on 2026-11-23; TrainingManager's `r.ok ? json : null`
escaped the guard test because it maps to null, not to []).
sweep: `grep -rn "r.ok ? r.json() : null" src/components | wc -l` → 12 in 10 files (incl. TrainingManager's team-name read, which only labels chips); TrainingManager's scenario/assignment read fixed here, the other 11 filed.
severity: medium

### F2 - free-text stage names can drift from tags
class: a match on user-typed text; a rep typing "Demo call" will not match a tag "Demo".
sweep: `grep -n "stagesInUse" src/app/api/coach/remote/scenarios/stages/route.ts` → the tag box offers the names in use.
severity: low

### F3 - stage names read past the reporting tree, with false row bounds (caught by the gates)
class: a manager route reading rep data with the service role (invariant 36) and `.limit(N > 1000)` (PostgREST cap).
sweep: `npm run check` → invariant-audit flagged src/app/api/coach/remote/scenarios/stages/route.ts for both; the
stage-name read now uses the caller's client (tree applies), both reads cap at 1000, and the route is allowlisted with
why its remaining service-role use touches only company-wide scenario tags. Re-run: `npm run check` exit 0, 6460 tests.
severity: medium
