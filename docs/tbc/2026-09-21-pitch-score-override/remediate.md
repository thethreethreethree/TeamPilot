# REMEDIATE

### F1 — the log was written but nothing could read it

fix: `readPitchScore` now returns `overrides` on every pitch — newest first, bounded, each row
  labelled from the rubric with a fallback to the raw id for an item a later rubric retired. Five
  read tests, seven mutations, all caught.
gate-or-promise: gate. `npm run invariant:audit` already contains the rule that caught this ("a
  finance table must be reachable from the product"), and it is in `npm run check` and CI. The
  table was **not** added to `RPC_ONLY_TABLES`, which was the tempting resolution and the wrong
  one: the allowlist entry would have been true about the *write* path and would have silenced the
  audit about the *read* path it was correctly complaining about. The gate fails without the
  author's cooperation, and it did.
residual: the rule fires on a table named nowhere in `src/`. A table named in `src/` but only in
  dead code would pass it — that hole is covered by `reachability:audit`, which is also in `check`.

### F3 — the skip banner hid the reason it was skipping

fix: `reachable()` became `unreachableReason()`, which returns the first error-shaped line of
  psql's stderr instead of a boolean; the banner prints `psql said: …`.
gate-or-promise: gate, and it is the script's own output rather than a separate check. Three paths
  were exercised before this shipped, which is the standard F2 of the migration-audit build failed
  to meet: a wrong role names the role, a missing container names the container, and correct
  credentials still apply all 254 migrations. A regression that re-swallows the reason shows up in
  the banner the next person reads, which is where it has to show up — a check *about* the honesty
  of a skip cannot itself be policed by a skippable check.
residual: the sweep returns roughly thirty bare `catch {}` sites across `scripts/`, not the handful
  I first assumed — and that number is the point, because it makes "just fix them all" the wrong
  response. Most are benign by construction: optional `.env.local` parsing, JSON-shape probes in
  one-off diagnostics, `await c.end()` on teardown. The dangerous subset is narrow and specific —
  **a bare catch on the path that decides whether a gate runs at all** — and this was the one. The
  others were not individually audited against that criterion; the sweep command is recorded in
  check.md so the boundary is a command someone can re-run rather than a claim I am making about
  thirty call sites I did not open.

### F2 — the "newest first" test did not test newest first

fix: the override mock records the `.order()` and `.limit()` arguments; the test asserts both the
  request (`{ col: "created_at", ascending: false }`) and the resulting array order, and a separate
  test asserts the bound.
gate-or-promise: declined, with the hole named (A33). There is no mechanical check that a mock is
  faithful to the client it imitates — writing one would mean type-checking test doubles against
  supabase-js's builder, which this codebase deliberately does not type (the un-generic
  `SupabaseClient` is what hid the `.eq()`-after-`.limit()` bug earlier today). What replaces it is
  a practice with a track record *in this session*: mocks that **record what was asked for** have
  now caught two real defects — the `.eq()`-after-`.limit()` runtime bug in `readPitchPeriod`, and
  this one. The hole: the next identity-function mock will make its own assertion untestable, and
  only mutation testing will reveal it. The sweep command in check.md is the manual boundary.
