# CHECK

## Commands run, by the project's own names

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run theme:audit` | 0 theme-bound leaks |
| `npm run rls:audit` | 0 missing policies, 0 tenant-pin risks |
| `npm run invariant:audit` | 1,044 files, **0 violations** |
| `npx vitest run` | **4,643 passed**, 15 skipped, 666 files |
| `npm run build:ci` | **✅ PASSED** |

## Two defects the audit found and I did not

Both were real, and neither was visible in the code to me.

**`.limit(2000)` is a false bound.** PostgREST caps at `max_rows=1000`. The consequence is not
"some old rows hidden": an answer outside the truncated window makes an **answered** dispute
reappear as open, and a manager re-answers work already done. Replaced with two bounded queries.

**INVARIANT 18 flagged the route as anon-writable.** `requireSalesCoachManager` was a name the
audit had never seen. The gate is real and the audit was right to distrust a name it could not
verify — registered with INV18 and INV26, each with a self-test asserting both that it is accepted
and that an ungated route is still rejected.

A third finding is only a note: the audit twice fired on my own **prose** — once on the
`NEXT_PUBLIC_` prefix in a docblock, once on `.limit(2000)` inside the comment explaining why
`.limit(2000)` is wrong. Text-scanning guards cannot tell code from commentary. Cheap to reword,
worth recording as the technique's cost.

## Mutation testing

**`readDisputes` (17 tests)** — rewritten after the bound fix, so re-mutated from scratch:

| Mutation | Result |
|---|---|
| V1 — continue without answers when the answer read fails | **1 failed** ✓ |
| V2 — any answer closes the dispute, ignoring order (re-filing lost) | **1 failed** ✓ |
| V3 — key answers by pitch only, ignoring the item | **5 failed** ✓ |
| V4 — swallow the dispute read error as an empty queue | **1 failed** ✓ |
| V5 — ignore the rep filter | **1 failed** ✓ |
| S6 — drop a retired item id | **1 failed** ✓ |

**Route (20 tests):**

| Mutation | Result |
|---|---|
| T1 — drop the manager gate on POST | **1 failed** ✓ |
| T2 — a failed queue read renders as empty | **1 failed** ✓ |
| T3 — drop the cross-tenant check on the write | **1 failed** ✓ |
| T4 — take `rep_id` from the request body | **survived → schema test added → 1 failed** ✓ |
| T5 — report the reply as saved regardless | **1 failed** ✓ |
| T6 — scope the queue to a company from the query string | **1 failed** ✓ |

**T4 is the one worth reading.** The behavioural test ("takes the rep from the PITCH not the
request") passed against a route reading `body.repId` — because zod strips unknown keys before the
route sees them. The protection is real and it lives in the **schema**, not the handler, so the
test was verifying it by accident. `AnswerSchema` is now exported and its shape asserted; adding
`repId` to it — the realistic way this breaks — fails a test, verified by doing exactly that.

**`DisputeQueue` (13 tests):**

| Mutation | Result |
|---|---|
| U1 — a failed read renders as an empty queue | **2 failed** ✓ |
| U2 — report a failed reply as saved | **1 failed** ✓ |
| U3 — drop the does-not-change-the-score copy | **1 failed** ✓ |
| U4 — omit the item id, closing the whole thread | **1 failed** ✓ |
| U5 — hide the filed-by-someone-else note | **1 failed** ✓ |
| U6 — show a reply box on an answered dispute | **1 failed** ✓ |

## Typecheck caught what vitest did not — again

The reader's tests passed green while `tsc` failed on the mock's row type. Third time in this
session that vitest has been green on code the typechecker rejects; vitest transpiles without
typechecking, so a green suite is not a green build. Both are run before anything is claimed.

## What is NOT verified

- **No browser has opened the queue.** It builds and prerenders; nobody has replied to a real
  dispute. Tests are jsdom.
- **No real dispute exists**, because no real pitch has been scored. The loop is closed in code
  and has never been walked by two people.
- **A manager cannot override a score**, only reply. Deliberate, and named in the residual.
