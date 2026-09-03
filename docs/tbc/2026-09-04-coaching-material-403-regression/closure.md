# CLOSURE — the coaching-material 403 is reachable again

## What shipped

Four lines on top of `main`. The route's failure path now asks `resolveApiUserId` whether anybody is signed in
before choosing between 401 and 403, so a caller with no company is told that — instead of being told they are not
authenticated, which is the one thing that is definitely untrue of them and which signing in again cannot fix.

The Bearer shim itself, merged by another session in `cf7f6a08`, is kept exactly as it is. This is a delta, not a
second implementation.

## Checks — commands, not moods (§3.2.3 / A38)

The canonical gate is pasted in check.md with its exit code. The check that matters more is the other one: main's
four lines were restored and the rewritten test was observed to FAIL against them before being kept.

```
  Theme-bound leaks: 0
  Missing policies:      0
  Violations:            0
  tbc:docs tbc:manifest tbc:artifacts tbc:residual tbc:freshness — all OK
 Test Files  616 passed | 1 skipped (617)
      Tests  4049 passed | 15 skipped (4064)
exit: 0
```

## The un-named reliance

- Relies on `resolveApiUserId` continuing NOT to require a profile with a company. If it ever gained that
  requirement it would return null for the same caller, and the 403 would go quiet again — this time with a test
  that does fail, which is the better failure mode but still worth knowing.
- Relies on both auth helpers continuing to refuse a company-less caller with `null`. If either ever returned a
  context with a null `companyId`, the fix would still be correct but the reasoning behind it would have changed.
- No caller reads this status today, so nothing observable depends on it yet. That is why it was worth fixing now.

## Residual (§4 / A36 — read from the top of the confidence ranking)

```json
[
  {
    "id": "R-2026-09-04-10",
    "item": "Other tests in this repo that mock a value their real function cannot return — the same shape as the 403 test that could not fail.",
    "why_skipped": "Felt like a one-off: the route was new, written quickly by another session, and the mock was an easy mistake to make in isolation.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-04T06:47:00+08:00",
    "outcome": "Opened because the confidence was high, and it took two turns to answer honestly. First sweep: every other test mocking resolveApiAuth supplies a real companyId, so none repeats this instance. Then a wider grep for `companyId: null` in any test found FOUR more files — and my first instinct was that the class had spread. It has not. Those four mock `requireCareAgent`, a different helper whose type declares `companyId: string | null` and whose body returns `profile?.company_id ?? null`. That value is genuinely reachable, so those mocks are legitimate and their 403 branches are real. The class does not extend beyond the one instance. What remains UNSWEPT is the general shape — 'a mock whose value the real function cannot produce' needs each function's reachable range, which no grep has — and that stays open here rather than being reported as absent."
  },
  {
    "id": "R-2026-09-04-11",
    "item": "The route against a real account with no company_id.",
    "why_skipped": "That account state cannot responsibly be manufactured in production, and no fixture reproduces a real profile row.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": null
  }
]
```

## For the owner

Branch `coaching-material-403-regression`, off `main`, nothing merged.

**And one branch to throw away:** `coach-material-bearer-mobile` is my own earlier version of the whole shim,
written before `main` had one. It is superseded — discard it rather than reviewing it. Two implementations of the
same route is the situation this project has been bitten by twice today already.
