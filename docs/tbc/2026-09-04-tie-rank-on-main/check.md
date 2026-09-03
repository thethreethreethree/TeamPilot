# CHECK — competition ranking, on top of current main

Audited against the built files (§3.3.1). `main`'s three ranking sites were read line by line **before** anything
changed, because 22 commits had landed since the superseded branch and the bug might already have been fixed. It
had not been.

## Canonical gate — `npm run check`

```
  Theme-bound leaks: 0
  Missing policies:      0
  Violations:            0
  tbc:docs tbc:manifest tbc:artifacts tbc:residual tbc:freshness — all OK
 Test Files  618 passed | 1 skipped (619)
      Tests  4075 passed | 15 skipped (4090)
exit: 0
```

## Targeted tests

```
npx vitest run .../competitionRank.test.ts .../weeklyDigest.test.ts .../leaderboard
 Tests  12 + 12 + 9 passed
exit: 0
```

Coverage: a tie shares a rank; the consumed place is skipped (1,2,2,4); a three-way tie resumes at 4; distinct
totals rank plainly; a bigint STRING ties with a number; rows are NOT re-sorted; an unreadable total becomes 0
rather than throwing; an empty board returns nothing; `rankOf` gives a shared rank not a row position, and null off
the board. Route: `meRank` is 1 for a tied caller, 4 after a two-way tie, 1 with mixed string/number totals. Digest:
a tie sends two golds and no silver in html and text, and the rep below a two-way tie is third with the bronze.

## Mutation check — and two came back MISSED

```
meRank back to position                -> CAUGHT
digest back to position (html)         -> CAUGHT
string totals no longer coerced        -> CAUGHT
board back to plain position           -> MISSED   <- a real hole
tie no longer skips a place            -> MISSED   <- an invalid mutation
```

**The first MISSED was a real gap, and it is why this build differs from the one it supersedes.** Reverting
`Scoreboard.tsx` to `{i + 1}` passed every test in the repository: nothing renders that component, so the shared
module can be perfect while the board beside it ranks by position again. A source-level check now closes it, and
was itself proven:

```
board reverts to plain position      -> CAUGHT
board renders the index directly     -> CAUGHT
digest reverts to plain position     -> CAUGHT
exit: 0 (sources restored in a finally block)
```

**The second MISSED was my own mutation being wrong, not a hole.** I replaced `i + 1` with `ranks.length + 1`
inside the loop — but `ranks` is pushed to after the assignment, so at that point `ranks.length === i` and the two
expressions are identical. No test could distinguish them because there was nothing to distinguish. Recorded
because a MISSED reported without checking whether the mutation was valid is how a phantom gap gets "fixed".

## Within-module pass (§1.5.1)

- **L1 structure.** One module, three consumers, no re-derivation — and now a check that keeps it that way.
- **L2 operational.** Board, `meRank` and digest agree for the same rows.
- **L3 the person.** Nobody is told they lost a tie they did not lose, including in an email to their manager.
- **L4 finish.** The podium accent follows the rank, so a tied pair both read as gold.

## Cross-module pass (§3.3.2 / A21)

"A place shown to a rep", inventoried across both repositories on **current** main — not carried from the earlier
sweep, because 22 commits could have added a fourth site.

```
grep -rn "rank" --include=*.ts --include=*.tsx src | grep -E "i \+ 1|index \+ 1|idx \+ 1"
```

| Surface | Ranks by | State |
| --- | --- | --- |
| `Scoreboard.tsx` | `competitionRanks` | fixed here |
| `leaderboard/route.ts` (`meRank`) | `rankOf` | fixed here |
| `weeklyDigest.ts` (manager email) | `competitionRanks` | fixed here |
| mobile `src/lib/gamification/leaderboard.ts` | its own `rank()`, same rule, tied on `totalPoints` | already correct |

The only remaining `i + 1` hits are the legitimate `ranks[i] ?? i + 1` fallbacks and one comment. No fourth site.

## Findings

### F1 — main still ranked by row position in three places

class: a place derived from a row's POSITION in an array rather than from the value being ranked.
sweep: the command above, on current main, plus the same shapes in the mobile repo.
severity: high — a false statement about a person's own performance, shown to their team and emailed to their
  manager.

### F2 — the render surface was outside the first build's gate

class: a rule with one definition, re-derived at a render site that no test renders.
sweep: mutation, not grep — reverting each consumer in turn and running the suite. Only the component survived.
severity: high as a latent risk; nothing was wrong in the shipped code, but the guard was absent, and the
  superseded branch would have merged with it absent.

## Inspected and NOT clean-billed (§3.3.5)

Inspected: main's three ranking sites before and after, the shared module, all three test files, and the mobile
app's own `rank()`. **Not inspected:** the rendered board and the rendered email with a real tie in them. Residual,
not a pass.
