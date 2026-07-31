# BUILD — INV18 mutation-route auth guard

### INV18 structural invariant

A build-time check in `scripts/invariant-audit.mjs` (run by `npm run check` + pre-commit) that fails
the build when a mutation route is reachable anonymously without a recognised gate.

- **write-path:** for each `src/app/api/**/route.ts` that exports POST/PATCH/PUT/DELETE
  (`MUTATION_EXPORT_RE`) and is NOT under the admin/extension/cron trees, if the file references no
  gate in `ROUTE_AUTH_RE` and is not in `PUBLIC_ROUTE_ALLOWLIST`, the check pushes a finding onto
  `findings[]` → the audit prints it and `process.exit(1)`. This is the "write" — the guard emitting a
  durable, build-failing signal that a class instance exists.
- **read-path:** `npm run check` (CI) and the pre-commit hook invoke `node scripts/invariant-audit.mjs`;
  a non-zero exit blocks the commit/merge, so a developer adding an ungated mutation route reads the
  failure at commit time with the file named and the fix/allowlist instruction. The success summary line
  now also states the INV18 guarantee so a green run positively asserts it.

Supporting:
- `PUBLIC_ROUTE_ALLOWLIST` — the 10 intentionally-public routes, each with its safety justification.
- `ROUTE_AUTH_RE` — the recognised-gate matcher (session / role / capability-token / shared-secret).
- Self-tests (`st(...)`) assert the scope regex matches only mutations, the auth regex rejects an
  ungated body and accepts each gate shape, and the allowlist knows a known-public route.
- The exceptions counter includes `PUBLIC_ROUTE_ALLOWLIST.size` (total now 27).

Files:
- `scripts/invariant-audit.mjs` — INV18 block + 9 self-tests + summary-line + exceptions count.
