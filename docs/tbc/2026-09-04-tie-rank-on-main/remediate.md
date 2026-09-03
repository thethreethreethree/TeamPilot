# REMEDIATE — fixes, and whether each is a gate or a promise

### F1 — main ranked by row position in three places

What changed: `Scoreboard.tsx`, `leaderboard/route.ts` and `weeklyDigest.ts` all take their place from
`competitionRank.ts`.

gate-or-promise: gate

```
meRank back to position          -> CAUGHT
digest back to position (html)   -> CAUGHT
string totals no longer coerced  -> CAUGHT
exit: 0
```

Each test names the behaviour in its title, so bringing the bug back means deleting a test that states the rule in
plain English.

### F2 — the render surface was outside the gate

What changed: two source-level assertions in `competitionRank.test.ts`, over `Scoreboard.tsx` and
`weeklyDigest.ts`.

gate-or-promise: gate

```
board reverts to plain position   -> CAUGHT
board renders the index directly  -> CAUGHT
digest reverts to plain position  -> CAUGHT
exit: 0
```

**Why a source check and not a render test.** The honest alternative was a component test, and this repository has
no component-rendering setup — adding one for a single assertion would be a larger change than the fix, introduced
during an App Store submission, to test a line that a three-line grep pins exactly.

Narrow on purpose (A33). It reads two named files with comments stripped, allows the legitimate
`ranks[i] ?? i + 1` fallback, and rejects only the index used AS a rank — assigned to a `rank`/`place` variable or
rendered directly. It cannot fire on correct code, and it does not fire on the many unrelated `i + 1`s in the repo.

**The hole it does not close:** a third render surface added later is not in the list. The list is hand-written, and
a hand-written list is only as complete as the person maintaining it. That is stated here rather than papered over,
and the sweep command in check.md is the thing that finds a new surface.

### The superseded branch

gate-or-promise: declined — housekeeping, not a defect

`tie-shares-rank` holds the same change against a `main` that no longer exists. It should be deleted rather than
merged; merging both would apply the change twice. Its content is fully contained here, plus the gate it lacked.
