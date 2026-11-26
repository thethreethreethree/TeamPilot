# CHECK - Engage E3: the public read API

## Commands

```
npm run db:verify → 0378 ok (rolled back)
probe p0378.mjs (production, rolled back): rename P0001; revoke ok; un-revoke P0001; scope 'write' 23514; an admin sees the key, a direct insert 42501
npx vitest run src/lib/api/__tests__/publicApi.test.ts → 6 passed (exit 0)
tsc clean · rls / invariant / reachability / writer / theme audits ✓
npm run check → gates the commit
```

## Findings

### F1 - the shared rate limiter keys by address, not by API key
class: a limiter keyed on the wrong identity.
sweep: publicApi.ts has its own per-key limiter; the daily limit is counted in the database.
severity: medium; found while building (the tests then showed the fourth request in a second refused).
