# BUILD — verify:live view-invoker guard

### public-view security_invoker check

A new `verify:live` check in `scripts/verify-invariants-live.mjs`.

- **write-path:** it queries the LIVE catalog for public views whose `reloptions` do NOT match
  `security_invoker=(on|true)` (case-insensitive regex). If the count is non-zero, `pass:false` → verify:live
  exits non-zero, naming the offending views — a view running as owner (RLS-bypassing) over tenant tables.
- **read-path:** `npm run verify:live` prints
  `✓ PASS no public VIEW bypasses RLS (every view is security_invoker on|true)` when healthy; a failure names
  the drifted view so the operator sees exactly which view lost invoker-security.

This is the LIVE complement to `rls:audit` (which parses migration TEXT): it catches a drift where live
diverges from the migrations, and it codifies the correct `on|true` predicate.

Files:
- `scripts/verify-invariants-live.mjs` — the new check (now 19 invariants total).
