# CLOSURE — competition ranking, on top of current main

## What shipped

Equals share a rank, and the place a tie consumed is skipped (1, 2, 2, 4), on the three surfaces that show a rep
their standing: the Scoreboard, the `meRank` the API returns, and the manager's weekly digest email.

This replaces the branch `tie-shares-rank`, which was built before `main` moved 22 commits underneath it. The
change is the same by design; **what is new is a gate the first build lacked**, added because a mutation showed
that reverting the Scoreboard to `{i + 1}` passed every test in the repository.

## Checks — commands, not moods (§3.2.3 / A38)

The canonical gate is pasted in check.md with its exit code.

```
  Theme-bound leaks: 0
  Missing policies:      0
  Violations:            0
  tbc:docs tbc:manifest tbc:artifacts tbc:residual tbc:freshness — all OK
 Test Files  618 passed | 1 skipped (619)
      Tests  4075 passed | 15 skipped (4090)
exit: 0
```

Eight mutations in total. Six CAUGHT. Of the two MISSED, **one was a real hole and is now gated**; the other was my
own mutation being invalid — `ranks.length + 1` and `i + 1` are the same expression at that point in the loop, so
no test could have told them apart. Both are written up rather than reported as "two gaps".

## The un-named reliance

- Relies on the 0243 aggregate returning rows already ordered by total. The ranker does not re-sort; if the
  function's ordering changed, the ranks would follow it.
- Relies on `total_points` being numeric or a numeric string. Anything else coerces to 0 and ranks last rather than
  breaking the board.
- The digest ties on `points`, the number its own row displays. If a column is ever added that it sorts by but does
  not show, the tie would turn on something the reader cannot see — the exact thing the rule was written to avoid.
- The render-surface check names two files. A third surface added later is not covered until someone adds it.

## Residual (§4 / A36 — read from the top of the confidence ranking)

```json
[
  {
    "id": "R-2026-09-04-15",
    "item": "Whether the MOBILE app still agrees with the web after 22 commits — it has its own rank() rather than importing this module.",
    "why_skipped": "It was checked earlier today and nothing in this build touches the app.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-04T07:52:00+08:00",
    "outcome": "Opened because the confidence was high, which is the rule. Read src/lib/gamification/leaderboard.ts in the app, rather than relying on the earlier check: rankNumber uses the identical shape — equals share lastRank, the next distinct total takes i + 1 — tied on totalPoints, the same field the web ties on. They agree. Worth noting WHY the app cannot simply import the web module: they are separate repositories with separate build systems, so the rule is mirrored by hand and pinned by tests on both sides. That is a standing risk this build does not remove, and it is the reason the app's own comment names the web module by path."
  },
  {
    "id": "R-2026-09-04-16",
    "item": "The rendered board and the rendered digest email with a real tie in them.",
    "why_skipped": "Needs live data with two reps on an identical total, which does not exist on demand.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": null
  }
]
```

## For the owner

Branch `tie-rank-on-main`, off current `main`, nothing merged. It merges cleanly — that is the whole point of
rebuilding it rather than rebasing.

**Delete `tie-shares-rank` rather than merging it.** It carries the same change against a `main` that no longer
exists, and merging both would apply the change twice.
