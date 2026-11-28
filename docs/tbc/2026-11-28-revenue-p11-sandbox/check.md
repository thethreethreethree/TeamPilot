# CHECK - sandbox company

## Commands

```
npm run db:verify → 0397 executes clean, rolled back (exit 0)
node scratchpad/probes/p0397.mjs → rolled back on production with stand-in sign-ins: refuses a real company (P0001); seeds 6 deals (open/won/lost, stages, amounts, close dates), 3 accounts, 4 contacts on deals, 3 calls of 8 lines, a 70/30 split; refuses a second seed; a signed-in user can't change the flag or call the seed (42501)
node scripts/sandbox/seed.mjs → usage; with --name and --admin-email (no --apply) → "Dry run: nothing written"
npm run check → gates the commit
```

## Findings

No findings beyond one the probe caught: sales_coach_role is admin | staff (the probe first used manager/rep).
