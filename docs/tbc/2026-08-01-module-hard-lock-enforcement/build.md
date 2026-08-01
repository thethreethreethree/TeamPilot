# BUILD — module hard-lock enforcement (Phase 5b/5c)

## Doc integrity (§0.1) — command + output think.md section 1 refers to
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Changes
- `supabase/migrations/0207_module_access_lock.sql` — add `companies.access_module` (care|sales_coach|null),
  backfill existing redeemed single-module accounts, recreate `redeem_pilot_code` VERBATIM + a stamp of
  access_module from the code's module. APPLIED live (DB at 0207).
- `src/middleware.ts` — after the auth redirect, for an authed user on /dashboard, one nested query reads
  `companies(access_module)`; `redirectForLock` sends a locked account to its module home. Fail-open on error.
- (Phase 5a already shipped the pure core `src/lib/auth/moduleAccess.ts` + 13 tests, 673789e3.)
