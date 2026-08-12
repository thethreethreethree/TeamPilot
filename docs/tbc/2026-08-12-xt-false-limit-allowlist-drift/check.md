# CHECK — false-limit allowlist drift fix

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — stale FALSE_LIMIT_ALLOWLIST entry = a silent guard blind spot
file+line: `scripts/invariant-audit.mjs` — the `care/agent/analytics/route.ts` entry in FALSE_LIMIT_ALLOWLIST.
class: guard/allowlist drift — an allowlist entry that outlived the exception it documented. Because INVARIANT 21
`continue`s on any allowlisted file, the stale entry meant a re-introduced `.limit(N>1000)` on that route would be
SILENTLY skipped — a blind spot on the exact file build xr had just fixed.
severity: low-medium (no live bug today; a latent regression hole in a CI guard).
sweep-command: `grep -n "route.ts" scripts/invariant-audit.mjs` over the FALSE_LIMIT_ALLOWLIST block cross-checked
against `grep -rnE "\.limit\(\s*[0-9]{4,}\s*\)" src` — every allowlisted file must still contain a live
`.limit(N>1000)`; `care/agent/analytics` was the only entry with no matching live limit (only a fix-history
comment), so it was the sole stale one. The other 5 still match a live limit → retained.
fix: reword the route's fix-history comment off the literal pattern, then remove the stale entry — restoring the
guard. The 5 still-real founder-gated entries are untouched.

## Detection test (A30 — the restored guard bites)
```
# temporarily re-introduced `.limit(5000)` on care/agent/analytics/route.ts:
$ npm run invariant:audit
  Violations:           1
✗ .limit(N) with N > 1000 is a false bound (PostgREST caps at max_rows=1000)
    src/app/api/care/agent/analytics/route.ts
# probe reverted; back to Violations: 0.
```

## Full gate
```
PENDING — pasted in closure after the run
```
