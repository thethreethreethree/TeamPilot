# REMEDIATE - doorlog honours the caller's own RLS client

### F1 - a data helper resolving its own client - FIXED

- closes: check.md F1.
- clause: A26 (sweep the class) + A30 (encode it in a gate) + SS3.4 (never a number the
  system cannot stand behind).
- what changed: all five rep-facing functions in `doorlog.ts` accept the caller's RLS client
  and use it when given; the four app-facing routes pass the client they had already
  resolved. The header records why the service client would be wrong here, so the next author
  meets the reasoning rather than the pattern.
- what remains: nothing for this instance.
- untested: the deployed behaviour. See F3.
gate-or-promise: GATE. `doorlog.callerClient.test.ts` mocks `createClient` to THROW, so a
rep-facing function that reaches for the cookie client despite being handed one fails by name
rather than quietly returning empty - which is exactly how this hid. Mutation-proven: reverting
`getKpiForDay` fails the named test. This is the guard the previous build could only promise.

### F2 - the remaining members of the class - DECLINED for now, named in full

- closes: check.md F2.
- clause: A26 + A33 (decline explicitly, name the hole).
- what changed: nothing in those files. Each was checked for reachability from the mobile
  app's 28 called routes and none is reached today.
- what remains: they are one route away from being defects. The honest guard is an
  invariant-audit rule - "a data helper reachable from a route that accepts a Bearer token
  must not resolve its own cookie client" - which needs reachability analysis the audit does
  not yet perform.
gate-or-promise: DECLINED, with the hole named. Changing nine files that are not broken, on a
guess about future routing, would be a large unverified auth change; and writing the
reachability analysis mid-outage is building the machine that watches the build rather than
the fix. What IS in place: the pattern's test now exists and can be copied per-module, and
every file is listed by name in check.md F2 so the next session starts from the boundary.

### F3 - unverifiable from the repository - DECLINED, by design

- closes: check.md F3.
- clause: A38 + A33.
- what changed: nothing in code. The measurement is recorded so confirming the repair is one
  command rather than a re-diagnosis.
- what remains: re-run the probe after deploy.
gate-or-promise: DECLINED. No gate can assert a property of a server this repository does not
run. The substitute is that the claim is withheld: closure.md states the door tracker is not
confirmed fixed until the post-deploy measurement matches the rows.

## Re-run (A38)
The canonical gate is run whole after these edits; output and exit code in closure.md.
