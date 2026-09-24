# REMEDIATE

### An authority that throws instead of refusing

gate-or-promise: **gate**, and it is structural rather than a check

`scoreSession` cannot throw any more. That is not a rule someone has to remember — the only exit
from the exported function is a `ScoreOutcome`, so no caller can be written that forgets to handle
a failure, because there is no failure shape left to forget.

Its six tests injected a throw at every await and each one fails without the guard.

**The promise that generalises:** when a function is the single authority for a decision (§2.2), it
owes its callers a VERDICT for every path — including the ones it did not anticipate. Returning a
verdict for the cases you thought of and an exception for the rest pushes the responsibility back
to every caller, and the caller that forgets is the one that runs 194 times.

### The file had no test of its own

gate-or-promise: promise, and it is the uncomfortable one

`scoreSession.ts` was created this morning as "the single authority", and shipped with its
behaviour covered only through its callers' tests. Those tests mock it, so they proved the
*callers* handled outcomes correctly and proved nothing about what it does when a read fails.

**The promise: a module introduced as an authority gets its own test file in the same commit.**
Not because coverage is a number, but because a mocked dependency is a dependency nobody has
tested. Everything the drain's tests asserted about refusals was true, and the thing that actually
broke was in the gap between the mock and the real function.

### Paging over a list whose head never leaves

gate-or-promise: promise

Three route tests pin the cursor and fail when `slice(0, BATCH)` is restored.

**The promise: before writing `slice(0, N)` in a drain, ask what removes an item from the list.**
If the answer is "success does", then items that can never succeed are permanent residents and the
window has to move independently of them. This is not specific to scoring — it is true of any
retry queue keyed on absence rather than on an attempt record.

**The better fix I did not make:** an `attempted_at` column would let the candidate query exclude
what has already been tried, making the cursor unnecessary and surviving across sessions. That is a
migration, and it is in the residual rather than in a hotfix a partner is waiting on.

### An error message that discarded the error

gate-or-promise: promise

**The promise: a failure branch prints the status and whatever the server said.** The route already
returned `{ error }` on every path; the panel read neither. The cost was not the outage — it was
that the outage could only be diagnosed by someone with the source open, and the founder sat in
front of a screen that knew and would not say.

This is the §1.5.3 "fail LOUD" clause pointed at the client rather than at config: a generic
sentence in place of a specific one is a silent failure wearing a message.

### A count is the wrong unit for a time bound

gate-or-promise: promise

`BATCH = 8` bounds the number of gradings; the platform bounds the seconds. Those are only the same
if every grading takes the same time, which is exactly what an LLM call does not do.

**The promise: a batch that spends unbounded time per item stops itself on the clock.** The budget
is the real constraint, the count is a proxy, and the proxy fails silently at the worst moment —
under load, on the largest backlog, which is the first time anyone runs it.
