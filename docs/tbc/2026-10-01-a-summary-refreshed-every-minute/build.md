# BUILD - a summary refreshed every minute

### A refreshed summary is stamped when it is written

- **write-path:** `src/lib/data/doorlog.ts` `upsertRepPatternSummary` sends `generated_at: now` on every write.
- **read-path:** `doorlog.rollupFreshness.test.ts`: the upsert payload carries a current `generated_at`, and
  `isRepDueForRollup(a pitch a minute ago, that generated_at)` is false.

### The post-deploy smoke matches the environment name Vercel uses now

- **write-path:** `.github/workflows/post-deploy-smoke.yml` `if:` matches 'Production' or 'Production [en dash] team-pilot' exactly.
- **read-path:** the Actions run for this commit's production deploy: run, not skipped.
