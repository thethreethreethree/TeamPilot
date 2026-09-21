# CHECK

## Commands run, by the project's own names

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run invariant:audit` | **0 violations** |
| `npm run reachability:audit` | **0 unreachable** |
| `npx vitest run` | **4,696 passed**, 15 skipped |

## Every row of the map was read, not inferred

| Row | Source opened |
|---|---|
| Band | `bands.ts` in full — five bands, boundaries, labels, sole-source docblock |
| Leaderboard total | `points.ts` (`computeSessionPoints`), `Scoreboard.tsx` (ranks by `total_points`) |
| Rank | `competitionRank.ts` — the loop, which is where the dense/standard claim was corrected |
| Milestones | `milestones.ts` — the five keys and their titles |
| Strong threshold | `bands.ts` — `STRONG_SESSION_THRESHOLD = 80` |
| Best pitch | `arenaSummary.ts` — `best` from the leaderboard row |
| Qualifying rule | `scorePitch.ts` — no gamification counterpart |

The one row I described from memory was wrong, which is the argument for the other seven.

## What is NOT verified

- **The map is a document, and documents go stale.** That is what happened to the build guide
  and cost an afternoon. Nothing enforces this table; it is a checklist, not a gate.
- **The milestone overlap is diagnosed, not resolved.** Neither strip is built. When one is, the
  decision — merge, rename, or deliberately keep both — is the founder's.
- **The leaderboard question is open**, and the fix so far is copy. No board has changed.
- **Nothing was rendered.** The rubric sheet's change is one string; its 17 tests pass, and no
  browser has shown it.
