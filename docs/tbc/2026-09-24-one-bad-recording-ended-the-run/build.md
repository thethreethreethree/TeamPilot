# BUILD — four fixes, each with a test that fails without it

### 1. `scoreSession` returns an outcome. It does not throw.

- **write-path:** the body moved to `scoreSessionOrThrow`; the exported `scoreSession` is a thin
  guard that catches and returns a new `errored` verdict. `console.error` server-side with the
  session id; the client gets `REFUSAL_MESSAGE.errored`, never the exception text (CWE-209).
- **read-path:** `src/lib/coach/pitchScore/__tests__/scoreSession.test.ts` — five throws injected
  at each await, one CWE-209 assertion.

**This is the §2.2 shape.** A caller that has to wrap this in its own try/catch is a caller taking
responsibility for a decision this function owns. Fixing it in the drain would have left the close
path and the manual button carrying the same landmine.

`errored` is deliberately **not** in `PERMANENT_REFUSALS`: a rate limit or a provider blip is worth
another pass, unlike a huddle.

The file had **no test of its own** before this. I created it this morning and shipped it untested
beyond its callers — which is how five separate throwing paths reached production.

### 2. The drain carries a cursor

- **write-path:** `candidates.slice(offset, offset + BATCH)`, with `nextOffset = offset +
  refusedCount` returned to the caller and sent back as `?offset=`.
- **read-path:** three route tests; mutation-tested by restoring `slice(0, BATCH)`.

Scored sessions leave the candidate list on the next read, so they must **not** advance the window.
Refused ones remain, so they **must**. Every pass consumes at least one candidate and the offset
only grows — that is the termination argument that replaces `more: scored > 0`.

My first attempt at this was `more: attempted > 0`, which would have looped forever re-billing the
same eight gradings. Caught by working the arithmetic before running it, not by the tests.

### 3. A time budget

- **write-path:** `BUDGET_MS = 210_000` against `maxDuration = 300`; the loop breaks and reports
  `ranOutOfTime`, and `more` stays true so the caller continues.

BATCH is a count, and a count is the wrong unit for a bound whose real limit is seconds. Eight
gradings at four seconds is fine; eight at forty is a platform kill — and a kill takes the function
down mid-loop, so the caller learns nothing and the writes already made in that pass are invisible
to it. A batch that ends early is a smaller batch; a batch that is killed is an unanswered question.

### 4. The panel says what failed

- **write-path:** reads `res.status` and the route's `{ error }` before giving up, and now says
  "press the button again to carry on" — which is true, because nothing already scored is re-billed.
- **read-path:** not rendered; the change is in the failure branch.

### Also

`new URL(req.url).searchParams` rather than `req.nextUrl` — the latter exists only on a
`NextRequest`, and the existing tests construct a plain `Request`. A route that can only be called
through Next's wrapper is a route its own tests cannot exercise.

```
$ npm run build:ci → "✅ Secretless build PASSED — CI's Build step will pass with this change."
$ npx vitest run …/backfill/__tests__/route.test.ts     → 16 passed
$ npx vitest run …/__tests__/scoreSession.test.ts       → 6 passed
```

## Mutation results — the tests can fail

| mutant | result |
|---|---|
| remove the try/catch from `scoreSession` (the state it shipped in) | **5 of 6 fail** |
| restore `slice(0, BATCH)` and `nextOffset = 0` | **3 of 16 fail** |
