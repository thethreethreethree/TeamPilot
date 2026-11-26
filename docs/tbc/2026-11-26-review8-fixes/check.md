# CHECK - Acting on the review of the reporting-tree fixes

## Commands

```
npx vitest run calibration usage list coach-assessment team-activity team → 63 passed (role change outside the tree 404, nothing written; failed tree check degraded)
node scripts/invariant-audit.mjs → Violations: 0 (team route no longer allowlisted; it asks the tree)
npx tsc --noEmit → clean; eslint → clean
```

## Findings

### F1 - a tree-limited manager could switch the company off the tree
class: an authorization decided as "same company" on a write.
sweep: invariant 36 now enforces the team route.
severity: high (latent: 0 companies on the tree)

### F2 - calibration 500 for large companies; silent empty pool on a failed lookup
class: a cap that throws; an unchecked read.
sweep: the pool read only.
severity: medium

### F3 - failed tree check shown as an empty team
class: error-as-no-data.
sweep: the four team views changed today.
severity: low

### F4 - a call repeated across OFFSET pages
class: offset paging over a live table.
sweep: the session list.
severity: low
