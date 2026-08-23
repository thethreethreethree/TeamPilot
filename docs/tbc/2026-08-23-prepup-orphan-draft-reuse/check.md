# CHECK — Prep-up orphan-draft reuse (audit D5)

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Violations 0
  Test Files  570 passed | 1 skipped (571)
       Tests  3732 passed | 15 skipped (3747)
EXIT: 0
```

## What the tests prove
- **`meetingPrep.draftReuse.test.ts` (NEW, 5):** `getOrCreateDraftMeetingPrep` REUSES a truly-empty draft (goal
  null + topics empty + draft + 0 docs); creates FRESH when there is no empty draft, when the empty-goal draft has
  TOPICS, when it has a DOCUMENT, and when the reuse probe ERRORS. The conservative "empty" contract is pinned so a
  prep with content can never be resurfaced.
- **`meeting-prep/__tests__/route.test.ts`:** the route's 401/403/200-shape still hold with the get-or-create call.

## Honest limit
The reuse query's exact PostgREST behaviour (the `is(goal,null)` + order/limit) is exercised through a table-keyed
mock, not a live DB; the emptiness LOGIC (topics/status/doc-count branches) — the part that could resurface real
work — is what the 5 tests pin directly. A live prod row won't be reused unless it satisfies all five conditions.
Client behaviour is unchanged (it still POSTs on mount + gets an empty prep), so the H2 flush-on-Start HIGH-fix is
not exercised here by design — it wasn't touched.

## Findings
No findings.
