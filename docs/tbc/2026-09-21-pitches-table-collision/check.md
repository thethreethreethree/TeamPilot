# CHECK

## The collision, reproduced before it was fixed

A prelude was written that includes what the first one omitted — the Door Log's `pitches` from
migration 0215 — and 0252 applied on top:

```
NOTICE:  relation "pitches" already exists, skipping
ERROR:   column "qualifying" does not exist
```

And the door-log table afterwards, unchanged:

```
 column_name
-------------
 knock_id
 name
```

No `base`, no `qualifying`, no `section_points`. **Migration 0252 cannot apply to production.**

## The fix, verified on the same realistic database

| | |
|---|---|
| 0252 → 0253 → 0254 apply in order | **all OK** |
| a full `store_pitch_score` round trip | 1 element, rejected bonus at 0.62 confidence |
| `section_points` sums to `base` | **62.4 = 62.4** |
| the Door Log's `pitches` after all three | still `knock_id` / `name`, **0 rows, untouched** |
| INVARIANT 4 on the renamed RPC | `authenticated_can_call = f` |

The fourth row is the one that matters: the two systems now have two tables, and the migration
that used to break the Door Log's schema no longer touches it.

## INVARIANT 28, proven by reinstating the bug

| | Result |
|---|---|
| real collision restored (`pitch_scores` → `pitches`) | **1 violation**, naming both files |
| restored | **0 violations** |

## Gates

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run rls:audit` | 0 missing policies *(9 → 0 after the allowlist was corrected)* |
| `npm run invariant:audit` | 1,047 files, **0 violations** |
| `npm run reachability:audit` | **0 unreachable** |
| `npx vitest run` | **4,696 passed**, 15 skipped |
| `npm run build:ci` | **✅ PASSED** |

## What is NOT verified

- **Nothing has been applied to production.** The claim is that these migrations now apply to a
  database shaped like production, verified against a prelude I wrote. That prelude is better
  than the last one and is still not production.
- **The prelude is hand-built, which is the flaw that caused this.** It now contains 0215 because
  I know to include it. It does not contain the other ~250 migrations, so a collision with any of
  those would be invisible in exactly the same way — INVARIANT 28 is the thing that covers that,
  not the prelude.
- **Only `pitches` was checked as a word.** The vocabulary sweep that found it has one entry.
