# CHECK

## Commands run

```
      Tests  4942 passed | 15 skipped (4957)
  Missing policies:      0
  Violations:            0
  Unreachable modules:   0
CHECK_EXIT=0
```

| Command | Result |
|---|---|
| `npm run check` | exit 0, with Postgres reachable |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run theme:audit` | 0 theme-bound leaks |

## The tests were made to earn their place

9 mutations. **All caught.**

**The ranking gate** (4): no gate at all · send a rep a filtered board · send a rep their rank ·
gate managers out too.

**The strength callout** (5): no callout · strength below the opportunity · strength by highest
raw points · an unattempted element counts as a strength · the opportunity dropped.

Two of the five survived first and are F4 below.

## Findings

### F1 — the gamification board served a full ranked list, with names, to every rep

class: a surface built before a rule existed, left unswept when the rule arrived. The
  `/scoreboard` nav entry is not `managerOnly`, and the route served rows to any company member.
  Its own docblock said so: *"Every company member may view it."*
severity: high, and it undid work from the same day. I had just restricted the Pitch Score board
  so a rep sees no rank — and one section below it on the same page sat a fully-ranked board with
  every rep's name.
sweep: the founder's ruling read against every rep-facing surface, which is the sweep the previous
  closure's R1 asked for and this build is.
fix: the route withholds rows and rank from a non-manager; the component says why.

### F2 — the Arena printed a rank on the rep's own dashboard

class: the same violation one surface further out. `RepArena` renders `rank #N` from the
  leaderboard's `meRank`.
severity: high, and it is the DEFAULT rep view — the clause says cross-agent ranking "is never the
  default view", and this was exactly that.
sweep: `grep -rn "meRank\|rank #" src/components/` — every consumer of a ranking endpoint.
fix: **none was needed.** Gating at the route rather than in `Scoreboard` meant the Arena stopped
  showing a rank without being touched. Verified by reading the path: `lb?.meRank ?? null` is now
  null and the clause is falsy. That is §2.2 paying rather than being argued.

### F3 — the breakdown led with a deficit

class: a document read for one clause and not the rest. I had quoted the KPI document's ranking
  sentence four times across three builds without reading its agent-view section, which also says:
  *"Growth-framed — lead with what improved, then growth areas."* The board opened on BIGGEST
  OPPORTUNITY.
severity: medium. Nothing is wrong; the framing is, and framing is what that document is about.
sweep: read §4 Reporting Surfaces in full, not the one line that keeps being quoted.
fix: a strength callout above the opportunity. **Partial** — the clause says what *improved*, which
  needs a period-over-period comparison the board does not have.

### F4 — two more fixtures that could not fail

class: the fifth and sixth instances of a negative or discriminating assertion made against an
  input where both implementations agree. The render fixture has two elements, and both wrong
  implementations of `strongestElement` pick the same one from it.
severity: low in effect, recorded for the rate.
sweep: the standing question — *does this fixture make the wrong answer POSSIBLE?*
fix: unit tests on the exported pure function, handed the cases that separate the implementations:
  a 2-point element hit every time against a 9-point element hit half the time, and an element
  never scored.

## What is NOT verified

- **The sweep covered the surfaces I could name.** `Scoreboard`, `RepArena`, `PitchBreakdown`,
  `PitchLeaderboard`, `NotificationBell`, the milestone strips. It was not mechanical, and a
  rep-facing surface I did not think of is not covered by anything here.
- **Nothing has been rendered in a browser.** Ninth consecutive build.
- **"Lead with what improved" is not implemented**, only approximated. A rep is shown what they are
  best at, not what has got better.
