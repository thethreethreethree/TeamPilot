# REMEDIATE — fixes, and whether each is a gate or a promise

### F1 — the 403 branch was unreachable

What changed: the failure path asks `resolveApiUserId` whether anybody is signed in before choosing between 401 and
403.

gate-or-promise: gate

```
main's shape (the regression)                -> CAUGHT
the identity fallback is dropped             -> CAUGHT
a signed-out caller gets 403 instead of 401  -> CAUGHT
exit: 0
```

The first line is the one that counts. The test was run against the previous code and observed to FAIL before it
was kept, so it is a check rather than a claim. The third guards the over-correction: answering 403 to everyone
would satisfy the headline and be wrong in the other direction.

### F2 — a test that pinned impossible behaviour

What changed: the 403 test drives the real shape — `resolveApiAuth` refuses, `resolveApiUserId` confirms somebody
is signed in — instead of mocking a return value that function cannot produce.

gate-or-promise: promise, and declined deliberately under A33 with the hole named

There is no precise check for "this mock returns something the real function never could". It would have to know
each mocked function's reachable range, which is the halting problem wearing a lint rule's clothes; anything
cheaper fires on every legitimate stub — and this file has three legitimate stubs (the corpus, the model, the
prompt builders) for every one that was wrong.

What replaces it is a habit with a command behind it, and it is the habit this build ran on: **restore the code the
test is meant to catch, and watch the test fail.** A test never seen to fail is a claim. That takes one command per
test worth trusting, and it is what found this.

The hole: nothing stops the next test from being written the same way. It is named here rather than papered over
with a gate that would be skipped within a week.

### The superseded branch

gate-or-promise: declined

`coach-material-bearer-mobile` carries my own earlier version of the whole shim, written before `main` had one. It
is superseded by this branch and should be discarded rather than merged — two implementations of the same route is
the situation this project has already been bitten by twice today, once with the band boundaries and once with the
ranking rule.
