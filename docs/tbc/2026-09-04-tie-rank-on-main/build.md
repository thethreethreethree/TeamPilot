# BUILD — competition ranking, on top of current main

A re-application, not a redesign (§3.2.1). The superseded branch's change is applied to `main` as it stands after
22 commits, plus one addition that a mutation proved was needed.

### The shared rule

- `src/lib/coach/gamification/competitionRank.ts` — `competitionRanks()` and `rankOf()`, with the bigint-as-string
  coercion PostgREST forces on `total_points`. Carried across unchanged; it is a new file, so nothing could conflict.
- `src/lib/coach/gamification/__tests__/competitionRank.test.ts` — 10 tests, plus 2 new source-level ones.

write-path: `competitionRank.ts:46` — every place is derived from the rows the 0243 aggregate already ordered. It
  does not re-sort: the RPC owns the ordering, and a second opinion here would put the ranks on the wrong rows.
read-path: consumed by the three surfaces below; no caller reads this module without rendering what it returns.

### The Scoreboard's row number and podium accent

- `src/components/sales-coach/Scoreboard.tsx` — `const rank = ranks[i] ?? i + 1`, driving both the number and
  `RANK_ACCENT[rank - 1]`.

write-path: `Scoreboard.tsx` — `competitionRanks(data?.rows ?? [])`, hoisted above the null guard. `data?.rows` and
  not `data.rows`: it runs before the guard, and reading it directly threw on first paint.
read-path: the row a rep reads on the team board. Two reps tied for first both carry the gold accent — the visible
  half of the fix.

### `meRank` in the leaderboard API

- `src/app/api/coach/gamification/leaderboard/route.ts` — `meRank: rankOf(rows, meIndex)`.

write-path: `route.ts:40`.
read-path: the web board's own "not on the board yet" branch and `RepArena.tsx`. **Not the mobile app** — that
  calls the RPC directly and computes its own rank with the same rule, which was checked rather than assumed after
  I had earlier claimed the opposite.

### The weekly manager digest

- `src/lib/coach/gamification/weeklyDigest.ts` — medals and the plain-text list both follow `competitionRanks`.
- `src/lib/coach/gamification/__tests__/weeklyDigest.test.ts` — the 2 tie tests carried across and re-run against
  main's current file rather than assumed to still apply.

write-path: `weeklyDigest.ts` — ranks over `summary.top`, tied on the same `points` the row displays, so the
  tiebreak is never invisible to the reader.
read-path: the email a manager opens on a Monday. A tie at the top sends two golds, no silver, and a bronze —
  third place is still third, so the rep below the tie keeps their medal; the one that disappears is the one nobody
  earned.

## The one thing this build adds

A source-level check over the two render surfaces, in `competitionRank.test.ts`.

**It exists because a mutation found the hole.** Reverting `Scoreboard.tsx` to `{i + 1}` passed every test in the
repo — nothing renders that component, so the module can be perfect while the board ranks by position again. The
superseded branch shipped with that gap.

The check allows the legitimate `ranks[i] ?? i + 1` fallback and rejects the index used AS the rank, with comments
stripped so it cannot fire on an accurate one.

## UNTESTED

The rendered board and the rendered email with a real tie in them. Both are exercised by unit tests over the same
pure functions those surfaces call, but neither has been looked at by a person.
