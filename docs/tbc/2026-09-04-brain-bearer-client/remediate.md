# REMEDIATE - brain reads the company's own config with the service client

### F1 - the cookie client on a Bearer-reachable path - FIXED (instance), class OPEN

- closes: check.md F1, for the two proven-broken reads only.
- clause: A26 (sweep the class, not the instance) + A30 (encode the fix at a chokepoint).
- what changed: `loadBrain()` and `loadControlGate()` in `src/lib/brain/index.ts` now use
  `createAdminClient()`. The read site carries the reasoning, the evidence (anon read empty,
  service read present) and the ripple-trace of all three callers, so the assumption that
  makes it safe lives where the next author will meet it.
- what remains: the twelve other cookie-client reads under `src/lib`. Two of them
  (`resolveApiAuth`, `auth-helpers`) are the cookie path itself and are correct. The other
  ten need a reachability check against Bearer-authenticated routes. Carried as BRAIN-R1.
- untested: the deployed behaviour. See F3.
gate-or-promise: PROMISE, and the hole is named. No gate yet forbids a NEW cookie-client read
on a Bearer-reachable path, so this class can recur the moment someone adds one. The honest
shape of the gate is an invariant-audit rule - "a data read reachable from a route that
accepts a Bearer token must not resolve its client from cookies" - which needs a reachability
analysis the existing audit does not yet perform. Writing that during a live outage, on a
guess about the twelve remaining files, would be building the machine that watches the build
instead of the fix the founder asked for. It is carried as BRAIN-R1 with the sweep command
attached so the next session starts from the boundary rather than from scratch.

### F2 - roleplay's bodiless 500 - REPORTING FIXED, cause OPEN

- closes: check.md F2, for the reporting half only.
- clause: A21 (one taxonomy, not hand-rolled copies) + A30.
- what changed: `POST` now wraps `handleRoleplay` and returns through the shared
  `llmErrorResponse`, so an LlmError keeps its status and `kind` and a non-LLM failure is
  logged server-side and answered with one honest sentence.
- what remains: the exception itself is unidentified. Roleplay runs through `dissectCoachV5`
  (`src/lib/claude.ts`, the Anthropic path) while `extension/dissect` uses a different engine
  and returns 200, which makes an Anthropic configuration fault the leading candidate. That is
  a hypothesis, not a finding, and it is deliberately not encoded in code. Carried as BRAIN-R2.
- untested: the deployed behaviour. See F3.
gate-or-promise: PROMISE. The durable guard would be a route test asserting that a thrown
engine error produces a body with a readable `error` field, which is worth writing once the
underlying cause is known and the fix is not a wrap. Named rather than claimed.

### F3 - unverifiable from the repository - DECLINED, by design

- closes: check.md F3.
- clause: A38 ("verified" names the command you ran) + A33 (decline explicitly, name the hole).
- what changed: nothing in code. The reproduction is recorded verbatim in think.md and the
  re-run command in check.md F3, so confirming the repair after deploy is one command rather
  than a re-diagnosis.
- what remains: the founder runs the probe, or opens the app, after deploying.
gate-or-promise: DECLINED. A gate cannot assert a property of a server this repository does
not run. The substitute is that the claim is not made: closure.md states plainly that the
mobile app cannot be confirmed fixed until deployed, rather than implying this build fixed it.

## Re-run (A38)

The canonical gate `npm run check` is run whole after these edits; its output and exit code
are recorded in closure.md's verification section.
