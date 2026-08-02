# BUILD — KPI compute-cron snapshot-error surfacing

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change

### KPI snapshot-error surfacing
The per-item persistence loop in `src/app/api/coach/kpi/compute-cron/route.ts`. Added `let snapshotErrors = 0;`
and changed the empty failure branch of `if (!insErr) snapshots += 1;` into an explicit surfaced failure.

- **write-path:** on a snapshot insert failure, the run now increments `snapshotErrors` **and**
  `console.error(...)`s the agent/metric/period (was: silently ignored). The preceding delete already ran, so a
  dropped snapshot is now recorded rather than invisible. An inline comment records why the failure path must
  stay surfaced (a dropped KPI must not be silent).
- **read-path:** the JSON response now returns `snapshotErrors` (non-zero = some snapshots were dropped this
  run, self-heals next run), alongside the existing `snapshots` / `computed` / `bounded`. A monitor reading the
  cron's output can now see a persistent failure instead of a silent zero.

No change to compute (`fn(rows)`), the delete, the period logic, auth, or schema.

Files:
- `src/app/api/coach/kpi/compute-cron/route.ts`
