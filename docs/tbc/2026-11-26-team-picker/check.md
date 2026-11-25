# CHECK - Show one manager's team on Coaching

## Commands

```
npx vitest run coaching-metrics coaching-inbox team-stats coverage usage → first: 5 failed (createAdminClient made eagerly; those tests don't mock it) → made lazy → 22 passed
npx vitest run teamScope + teams route → 6 passed
npx vitest run team-stats + remote-sales components + CoachingInbox → 118 passed
npx tsc --noEmit → clean · eslint (changed files) → clean
```

## Findings

### F1 - a team parameter could reach outside the caller's tree
class: a new narrowing input that names a person.
sweep: the caller must pass treeAllowsRep for the chosen manager before anything is read; the team only intersects each route's existing filter.
severity: high (designed out; tested)

### F2 - the team read ran on every request
class: an eager service-role client for an optional parameter.
sweep: the client is created only when ?team= is present (found by the route tests).
severity: low

### F3 - four copies of the URL helper
class: duplicated logic.
sweep: one withTeam in teamQuery.ts.
severity: low

## Final

```
npm run check → first ✗ tbc:manifest (§3.1 reason too short) → rewritten → exit 0 · Test Files 957 passed | 1 skipped · Tests 6909 passed | 15 skipped
```
