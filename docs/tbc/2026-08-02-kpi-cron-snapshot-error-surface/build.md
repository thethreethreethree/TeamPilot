# BUILD — KPI compute-cron snapshot-error surfacing

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change
`src/app/api/coach/kpi/compute-cron/route.ts` — the persistence loop.

- Added `let snapshotErrors = 0;`.
- The insert-result handling changed from `if (!insErr) snapshots += 1;` (empty failure branch) to: on
  success `snapshots += 1`; on failure `snapshotErrors += 1` **and** `console.error(...)` naming the agent,
  metric, and period.
- The response now returns `snapshotErrors`, with a comment that non-zero means some snapshots were dropped
  this run (self-heals next run) and is never silent.
- An inline comment above the branch records WHY the failure path must stay surfaced (the delete already ran;
  a dropped KPI must not be invisible — §3.4).

No change to compute (`fn(rows)`), the delete, the period logic, auth, or schema.

Files:
- `src/app/api/coach/kpi/compute-cron/route.ts`
