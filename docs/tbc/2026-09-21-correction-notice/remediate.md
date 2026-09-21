# REMEDIATE

### F1 — the first draft sent the rep to another feature's screen

fix: the link points at `/dashboard/sales-coach/${session_id}`, the session page where
  `PitchScorePanel` and the corrections section render, with the reason written beside it.
gate-or-promise: gate. Two mutations now fail — one that restores the door-log route and one that
  sends a correction to the debrief — so the specific wrong destinations cannot come back. The
  broader class, a hard-coded link into a feature whose vocabulary overlaps another's, is **not**
  gated: nothing checks that a route segment receives the kind of id it expects, and Next.js route
  params are strings either way. The sweep command in check.md is the manual boundary.
residual: "pitch" names two entities in this product and always will. The Door Log's report card
  and the Pitch Score detail are both reachable, both real, and only their URL shape distinguishes
  them.

### F2 — a throwing notifier would have 500'd a correction that already landed

fix: `try/catch` at the route in addition to the notifier's own, with the reasoning stated — the
  callee's internal catch is a promise the route cannot enforce.
gate-or-promise: gate. The mutation "let a throwing notifier fail the request" now fails. What
  makes this one durable is that the test asserts a **200 with the override id**, so a future
  refactor cannot satisfy it by catching and returning a different error.
residual: the same shape exists wherever a side effect is awaited after a primary write. One sweep
  command is recorded; the other call sites were not individually audited.

### F3 — a second correction would have arrived late, not live

fix: the subscription listens for `event: "*"` rather than `INSERT`, scoped to the same recipient
  filter, with the reason at the call site.
gate-or-promise: gate, and it needed the test to be rebuilt before it was one. The realtime client
  is now mocked to RECORD what the bell subscribes to, so the filter is asserted rather than
  assumed — before that, the mutation back to `INSERT` survived because the suite had disabled
  realtime entirely.
residual: the assertion proves what the bell ASKS FOR. No socket has connected, and whether the
  table is in the Supabase realtime publication is dashboard config this repo cannot hold — an
  inherited external dependency, not a new one.

### F4 — two bell tests could not fail

fix: the failed-read test advances the 60s poll with fake timers instead of clicking a button that
  only toggles a dropdown; the realtime test mocks the client instead of switching the subsystem
  off.
gate-or-promise: declined, with the hole named (A33). There is no mechanical check that a test
  exercises the mechanism it claims to — a test that cannot fail passes, which is the entire
  problem, and coverage tooling would have reported both of these as covered lines. What replaces
  it is the practice that caught them: **every new unit in this session has been mutation-tested,
  and a surviving mutant is treated as a finding rather than an equivalence** until a control says
  otherwise. Three survivors have appeared today; one was genuinely equivalent and two were tests
  that could not fail. The hole is that mutation testing is run by hand.
