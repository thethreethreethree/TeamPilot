# BUILD — module hard-lock enforcement (Phase 5b/5c)

## Doc integrity (§0.1) — command + output think.md section 1 refers to
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

### companies.access_module signal (migration 0207)
`supabase/migrations/0207_module_access_lock.sql` — the reliable lock signal. APPLIED live (DB at 0207).

- **write-path:** add `companies.access_module` (care|sales_coach|null); backfill existing redeemed
  single-module accounts; recreate `redeem_pilot_code` VERBATIM + one line that stamps access_module from the
  code's module (so future redemptions lock automatically).
- **read-path:** a company member reads their own `access_module` via the 0001 companies SELECT policy
  (pilot_codes is RLS-sealed, so this column is the only member-readable home for the signal).

### Middleware module hard-lock enforcement
`src/middleware.ts` — confines a single-module account to its module subtree.

- **write-path:** after the existing auth redirect, for an authed user on /dashboard, one nested query reads
  `companies(access_module)`; `redirectForLock` (the tested pure core) returns the module home for a stray
  request → `NextResponse.redirect`. Fail-OPEN on lookup error (never lock a legitimate user out).
- **read-path:** a locked account lands in / stays in its module; a stray URL silently redirects home. A
  complete/legacy (null) account is unaffected — full hub access.

(Phase 5a already shipped the pure core `src/lib/auth/moduleAccess.ts` + 13 tests, 673789e3.)
