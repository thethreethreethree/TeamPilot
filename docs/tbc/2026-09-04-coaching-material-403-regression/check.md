# CHECK — the coaching-material 403 is reachable again

Audited against the built files (§3.3.1). The claim that the 403 was unreachable was not inferred from the diff —
both auth helpers were opened and the lines that return `null` were read.

## Canonical gate — `npm run check`

```
  Theme-bound leaks: 0
  Missing policies:      0
  Violations:            0
  tbc:docs tbc:manifest tbc:artifacts tbc:residual tbc:freshness — all OK
 Test Files  616 passed | 1 skipped (617)
      Tests  4049 passed | 15 skipped (4064)
exit: 0
```

## Targeted tests — `npx vitest run .../coaching-material`

```
 Test Files  1 passed (1)
      Tests  3 passed (3)
exit: 0
```

## The test was proven to FAIL against the previous code

This is the check that matters, because the defect being fixed was itself a test that could not fail. Main's exact
four lines were restored and the suite re-run:

```
main's shape (the regression)  -> CAUGHT
exit: 0 (source restored in a finally block)
```

## Mutation check — every guard proven by breaking it

```
the identity fallback is dropped             -> CAUGHT
a signed-out caller gets 403 instead of 401  -> CAUGHT
company id no longer the caller's            -> CAUGHT
exit: 0
```

The second matters as much as the first: the fix must not over-correct. A caller who is genuinely signed out must
still receive 401, and a version that answered 403 to everyone would satisfy the headline test while being wrong in
the other direction.

## Within-module pass (§1.5.1)

- **L1 structure.** No new helper. `resolveApiUserId` already existed for exactly this, and its own comment records
  the same mistake being made once before on `/[id]/outcome`.
- **L2 operational.** 401 and 403 now each have a reachable path, driven by tests through the real functions.
- **L3 the person.** A rep with no company is told what is actually wrong instead of being sent to sign in
  repeatedly against a condition signing in cannot change.
- **L4 finish.** Nothing visible changes today, and check.md says so rather than implying a screen was fixed.

## Cross-module pass (§3.3.2 / A21)

The concept is "a route that distinguishes not-signed-in from no-company". Swept every route using
`resolveApiAuth`:

```
grep -rln "resolveApiAuth" src/app/api | while read f; do
  grep -q "if (!ctx) return.*401" "$f" && grep -qE "if \(!companyId\)|!ctx\.companyId" "$f" && echo "$f"
done
```

Exactly one hit — this route. The `/[id]/outcome` route that hit this before already uses `resolveApiUserId`, which
is where the pattern came from.

## Findings

### F1 — the 403 branch was unreachable

class: a guard written against a value the function it guards cannot return.
sweep: the command above, over every route using `resolveApiAuth`. One instance.
severity: medium — no screen reads the status today, so nothing is visibly broken; but it is a wrong answer to a
  real caller, and the wrong answer names the one thing that is not true of them.

Verified by reading both auth paths rather than by inferring from the diff: `resolveApiAuth`
(`if (!profile || !profile.company_id || profile.status === "removed") return null`) and `getCurrentAuthContext`
(`if (!profile?.company_id) return null`).

### F2 — the test that reported the branch as covered could not fail

class: a test whose fixture is a value the production code cannot produce.
sweep: read every mock in the file against the real signature of what it replaces. One instance — the others mock
  the corpus and the model, which genuinely can return what the fixtures say.
severity: high, and higher than F1. The regression alone is a wrong status code. The regression plus a test that
  never fails is a wrong status code nobody will look for again, because the file reports the branch as handled.

The rewritten test was run against the previous code and observed to fail before it was kept. A test not seen to
fail is a claim, not a check.

## Gate-the-lesson (§3.3.4 / A30)

Answered per fix in remediate.md.

## Inspected and NOT clean-billed (§3.3.5)

Inspected: both auth helpers in full, this route before and after, its whole test file, the single web caller, and
every route using `resolveApiAuth` for the same shape. **Not inspected:** the route against a real account with no
company — that state cannot responsibly be manufactured in production. Residual, not a pass.
