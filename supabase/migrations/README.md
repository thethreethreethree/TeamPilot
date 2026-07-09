# Migrations

Sequential SQL migrations (`NNNN_slug.sql`), applied in order. Idempotent by convention
(`create or replace`, `drop … if exists` before `create`, `on conflict … do nothing`) so a
re-run is a clean no-op — see ThinkerThinker.md **A12**.

## Before you write or review a migration: the constitutional invariants

The constitution's structural core is enforced HERE, in the schema — as `do instead nothing`
rules, column-freeze triggers, the Understanding-Gate trigger, and `security definer`
search_path pins — not in application code, so it can't be bypassed. **`npm run check` does
NOT verify these stay in place.** A migration that drops one passes the green gate while
silently removing a constitutional guarantee (§5, at the schema layer).

**The rule:** if your migration touches any object listed in
[`docs/constitutional-db-invariants.md`](../../docs/constitutional-db-invariants.md) — any of
the 22 append-only tables, the 5 column-freeze triggers, the `problems_understanding_gate`
trigger, a `security definer` function's search_path, or the vendor/authz guard triggers —
**confirm the invariant survives your change**, and update the registry if you add a new one.

Quick self-check for the append-only set (should stay ≥ 22):

```
grep -rhoE "on (update|delete) to [a-z_]+ do instead nothing" *.sql | sort -u | wc -l
```

New `security definer` function? It MUST `set search_path = public` (A23 / migration 0088's
lesson). New event kind emitted into `events` but not mapped to a signal? Document it as an
`enabled=false` `signal_sources` row so it's a legible deferral, not an accidental orphan
(the 0026 / 0099 discipline).
