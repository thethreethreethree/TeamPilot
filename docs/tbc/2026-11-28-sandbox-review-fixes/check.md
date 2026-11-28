# CHECK - sandbox review fixes

## Commands

```
npm run db:verify → 0398 clean, rolled back
node scratchpad/probes/p0398.mjs → rolled back on production: refuses a real company; refuses a removed rep; seeds 6 deals / 3 calls of 8 lines; refuses a second seed; signed-in can't flag or seed
node scripts/sandbox/seed.mjs --name … --admin-email … → dry run, nothing written
npx vitest run dissectBackfill.test (nightly skips sandbox; scoped still runs) → 12 passed
npm run check → gates the commit
```

## Findings

No findings left open. Fixed from the review: a stopped run stranding the admin, AI spend on sample calls overnight, removed people in the seed, lost sign-in errors, an overwritten name, the earbud source label, a silent lookup ceiling. Confirmed sound: no signed-in path to is_sandbox (definer onboarding inserts fixed columns), the seed against every check and trigger, webhooks not firing on insert, the banner's read and legibility.
