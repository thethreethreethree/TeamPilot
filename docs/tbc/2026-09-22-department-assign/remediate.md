# REMEDIATE — a capability with a read, two writers, and no door

### Four fixture bugs in one session

gate-or-promise: declined

Each of the four is fixed where it was, with the reason written above the line so the next reader
does not rediscover it:

- `"timestamp_s" in over` instead of `??`, with a note that `??` treats the value a test exists to
  exercise as an absent one.
- `inCallsOn(calls, "files")` instead of a global matcher, with a note that the loose version
  passed for the wrong reason.
- `SINGLE_ROWS` split from `TABLE_ROWS`, with a note that the conflated version could not reach the
  state its test described.
- RFC-4122-shaped uuids, with a note that the variant nibble must be 8, 9, a or b.

**Declined as a gate, and this is the uncomfortable one.** There is no check that can tell a
fixture which cannot reach its state from one which can. The fixture is data; its only
specification is the test's name, in English. A linter cannot read that, and a test asserting
"this setup produces the state I claim" is just the test again.

What actually caught three of the four was a failure message strange enough to prompt re-reading
the setup — a habit, not a gate. What caught the fourth was mutation-probing a test that had
reported success, which IS a practice with teeth and is already applied to every behavioural claim
in this session's builds.

So the honest position: the practice exists and is used; the class is not gateable; and writing
that down is worth more than a gate that would fire on every fixture and be silenced within a week
(A30 — an imprecise gate is worse than none).

### The end-to-end claim, and the harness three builds now want

gate-or-promise: promise

Assign a department in the UI → upload a file → watch it route. The three links are covered
separately and nothing crosses them.

The missing piece is the same one 0264, the Files build and 0265 each named: a harness that runs a
read or a route against a real database. `migration_audit_scratch` already replays every migration
on demand, and the 0265 build demonstrated the rest of the shape — seed rows, `set local role
authenticated`, impersonate, assert, roll back. That is most of a harness, written twice now as
one-off probes.

The promise: the next build in this area is that harness, and its first subjects are the ones
already named — 0264's view, `listFiles`' embed, and this route's RLS.
