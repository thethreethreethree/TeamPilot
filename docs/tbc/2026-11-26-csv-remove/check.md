# CHECK - Removing people with the team CSV

## Commands

```
npx vitest run team (lib, routes, components) → 91 passed; import route → 9 passed (removal order and outcomes)
noFailedReadAsEmpty, americanSpelling → 7 passed; invariant-audit 0; theme clean; reachability passed; tsc clean; eslint clean
npm run check → gates the commit
```

## Findings

### F1 - the CSV couldn't remove anyone
class: missing bulk action (F2.8).
sweep: team import.
severity: low

### F2 - "last admin" counted removed admins
class: a guard over the wrong set.
sweep: setMemberRole and the new removeMember (the two last-admin checks).
severity: medium (the last active admin could be demoted while a removed admin remained)
