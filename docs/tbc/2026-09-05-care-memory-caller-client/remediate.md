# REMEDIATE - the coach memory honours the caller's own client

### F1 - a Bearer route reading through a cookie client - FIXED

- closes: check.md F1.
- clause: A26 (sweep the class) + A30 (encode it in a gate) + SS3.4 / SS3.6.
- what changed: `loadCoachMemory` accepts the caller's RLS client and uses it when
  given; `care/extension/coach` passes the one it can already build from the Bearer
  token it authenticated with. Not the service client - RLS plus the per-row actor
  filter IS the access control for a person's own event history.
- what remains: nothing for this instance.
- untested: the deployed behaviour. See F5 below.
gate-or-promise: GATE. `memory.callerClient.test.ts` mocks `createClient` to THROW,
so a rep-facing read that reaches for the cookie session despite being handed a
client fails by name rather than returning an empty snapshot - which is exactly how
this hid. Mutation-proven: reverting the one line fails three named tests.

### F2 - the remaining members of the class - DECLINED, named in full

- closes: check.md F2.
- clause: A26 + A33 (decline explicitly, name the hole).
- what changed: nothing in those seven modules. Each was checked transitively
  against all 331 routes and none is reachable from a Bearer caller.
- what remains: they are one route away from being defects.
gate-or-promise: DECLINED, with the hole named. The durable guard is an
invariant-audit rule - "a library module reachable from a Bearer-accepting route
must not resolve its own cookie client" - which needs the transitive reachability
walk the audit does not yet perform. Changing seven working files on a guess is the
larger risk, and building the analysis into the audit unasked is the machine that
watches the build rather than the fix. The sweep command is recorded in check.md F2
so the next session starts from the boundary, and the test pattern in this build is
copyable per module.

### F3 - the circular heuristic - FIXED in the method, not in code

- closes: check.md F3.
- clause: SS2 (a repeated failure means the identification was wrong) + A21.
- what changed: the sweep script's Bearer regex no longer counts `careAgentAuth`,
  and that module is listed with the cookie front doors where it belongs. The
  corrected run is what every conclusion in this build rests on.
- what remains: the underlying habit. Twice in two days a one-hop check gave a
  confident wrong answer - first on roleplay, then on this sweep.
gate-or-promise: PROMISE, and deliberately so. The fix is a reasoning discipline
(verify that each thing in a heuristic is what the heuristic claims), and encoding
a rule about my own analysis scripts would be process rather than product. It is
written into think.md where the next reader of this build will meet it.

### F4 - the flaky suite - RECORDED, not chased

- closes: check.md F4.
- clause: A38 ("verified" names the command you ran).
- what changed: nothing. The failing test could not be identified because the run's
  output was not captured.
- what remains: catch it. The next several runs should redirect to a file so the
  name survives.
gate-or-promise: DECLINED for now. Chasing an unidentified intermittent failure
without a captured name is guesswork; what is NOT declined is the honesty - this
build does not claim a clean suite, it claims 4,106 passing on the captured run and
one earlier failure it cannot name.

### F5 - unverifiable from this repository - DECLINED, by design

- closes: the untested note in F1.
- clause: A38 + A33.
- what changed: nothing in code. The reproduction is a Bearer call to
  `care/extension/coach` observing whether the prompt carries a
  `USER PATTERN HISTORY` block.
- what remains: the founder deploys, or asks for the probe to be run.
gate-or-promise: DECLINED. No gate can assert a property of a server this repository
does not run. The substitute is that the claim is withheld: closure.md says the
C.A.R.E extension's memory is not confirmed restored until it is deployed.

## Re-run (A38)
The canonical gate is run whole after these edits; output and exit code in closure.md.
