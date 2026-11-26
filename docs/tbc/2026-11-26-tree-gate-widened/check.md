# CHECK - The reporting-tree audit sees every manager check

## Commands

```
node scripts/invariant-audit.mjs → Violations: 0 (invariant 36 widened; 11 newly matched routes: 1 fixed (coach-assessment), 10 listed with reasons)
npx vitest run recordings rep-activity skills elo team-activity coach-assessment → 27 + 6 passed (404 outside the tree)
production count: profiles with a manager 0 — no company uses the tree yet, so nothing was exposed
npx tsc --noEmit → clean
```

## Findings

### F1 - six manager routes skipped the tree (recordings, rep-activity, team-activity, skills, ELO, coach-assessment)
class: a service-role read without the tree check.
sweep: invariant 36 widened to every manager check.
severity: high (latent: 0 companies on the tree)

### F2 - invariant 36's trigger missed them
class: an audit keyed on one helper's name.
sweep: MANAGER_CHECK_RE.
severity: medium
