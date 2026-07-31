# CLOSURE — verify:live view-invoker guard

## What shipped

A `verify:live` check asserting every public view has `security_invoker` enabled (predicate matches both
`on` and `true`). It is the LIVE complement to `rls:audit`'s migration-text parse — catching a drift where a
view loses invoker-security live while the migrations still say safe — and it codifies the correct predicate
so the string-match bug that produced my false "14 views bypass RLS" finding cannot recur. 19/19 invariants
hold; detection-tested.

## What I relied on that is NOT self-evident (the un-named-reliance half)

- **`security_invoker` renders as `on` in the catalog, `true` in migrations.** The whole incident turned on
  this. The predicate matches both; if a future Postgres changed the rendering, the detection test would
  catch it.
- **This is a catalog check, not a behavioral one.** It asserts the OPTION is set; the definitive proof of
  safety is behavioral (`SET LOCAL ROLE anon; SELECT` → 0), which I ran during the correction and which the
  option-set state implies. A view could in principle be invoker-safe yet still leak via a SECURITY DEFINER
  function it calls — out of scope here (that is the definer-revoke item's territory).

## Residual (A36)

```json
[
  {
    "id": "RES-01",
    "item": "The guard flags ANY public view lacking security_invoker, with no allowlist. If a future legitimate view over NON-tenant/public reference data is added without the option, it will (correctly, conservatively) fail until either the option is added or an allowlist is introduced.",
    "why_skipped": "0 offenders today, so no allowlist is needed yet; adding one pre-emptively invites the same false-safety the incident came from. The conservative fail-closed default (every view invoker) is the safe direction — a reviewer adds an allowlist entry WITH a reason if a genuine non-tenant view ever needs it.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-31T13:18:00Z",
    "outcome": "OPENED + accepted: fail-closed with no allowlist is correct until a real exception exists; named so the future-exception path is explicit."
  },
  {
    "id": "RES-02",
    "item": "rls:audit (migration-text) and this guard (live catalog) now overlap. They are NOT redundant — text catches an unsafe view before it deploys (in CI without a DB); live catches a drift the text can't see (a view changed outside the tracked migrations).",
    "why_skipped": "Deliberate defense-in-depth, not duplication — the incident is the proof they answer different questions (text was green while I wrongly believed live was unsafe; the correct resolution was a live check).",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-31T13:18:00Z",
    "outcome": "OPENED + confirmed intentional: text-time + run-time are complementary layers."
  }
]
```

## Verification

verify:live 19/19 + predicate detection test (see check.md), exit 0. Full `npm run check` is the CI gate.
