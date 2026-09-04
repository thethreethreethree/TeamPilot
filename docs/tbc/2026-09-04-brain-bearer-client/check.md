# CHECK - brain reads the company's own config with the service client

## Canonical commands
```
$ npx tsc --noEmit
EXIT_TYPECHECK=0

$ npx eslint src/lib/brain/index.ts src/app/api/coach/sales-session/roleplay/route.ts
EXIT_LINT=0

$ npm test
Test Files  621 passed | 1 skipped (622)
     Tests  4099 passed | 15 skipped (4114)
```

## The guard still bites (mutation, A38)
The SS3.4 suppression branch was disabled in source and the gate tests re-run:

```
$ (mutate) if (false && !gate.guidanceEnabled && !args.controlExempt) {   # 2 sites
$ npx vitest run src/lib/brain/__tests__/runBrainCall.gate.test.ts src/lib/brain/__tests__/runBrainStream.gate.test.ts
 FAIL  runBrainCall   > SUPPRESSES during the control window: provider NEVER called
 FAIL  runBrainStream > SUPPRESSES during the control window: yields NOTHING + provider NEVER called
      Tests  2 failed | 4 passed (6)
$ (restore)
      Tests  6 passed (6)
```

The mutation was confirmed APPLIED (2 sites) before the result was read - an "uncaught" mutation that
never applied proves nothing.

## Contract check, read this session
- `createAdminClient()` is synchronous and throws when `SUPABASE_SERVICE_ROLE_KEY` is absent; that key
  is present in production, proven by probe: a bogus Bearer against a `resolveApiAuth` route returns
  401 (the getUser rejection), not the 500 a missing key would raise.
- SS3.4 re-read this session: the control window governs WHETHER guidance runs. This change alters
  only WHICH client reads the flag, never the decision. `evaluateControlGate` is untouched.

## Findings

### F1 - a Bearer-reachable path read data with the cookie client

class: server code that resolves its database client from COOKIES while sitting on a path
  reachable by a Bearer-authenticated caller (the mobile app, the browser extension). The
  instance was `loadBrain`/`loadControlGate`; the class is every such read.
sweep: `grep -rn "await createClient()" src/lib --include=*.ts`
  Returns 14 files. Two were on the proven-broken path and are fixed. The remaining twelve
  (v5/debrief, v5/memory, data/doorlog, data/dissect, data/files, data/meetingPrep,
  data/departments, data/assetReadout, brain/learn, careAgentAuth, resolveApiAuth,
  auth-helpers) are NOT all defects - `resolveApiAuth` and `auth-helpers` are the cookie
  path itself and are correct there. Each of the others needs a reachability check.
severity: critical - it took every AI feature in the mobile app offline while the web app
  looked healthy, and it presented as a network fault, which is why it survived for hours.

### F2 - roleplay answered a crash with an empty 500

class: a route that runs work outside a try, so an exception is answered by the framework
  with no body. A bodiless 5xx is unreadable to a client: `HTTP 500` carries no sentence, the
  app's error reader correctly refuses it, and the screen falls back to guessing the cause -
  which is how a rep on full signal was told to find signal.
sweep: `grep -rLn "catch" src/app/api/coach/**/route.ts` for coach routes that call an LLM
  engine with no catch. Roleplay is fixed; the sweep across sibling routes is carried as
  residual, since each needs its own reading rather than a blanket wrap.
severity: high - it hid the cause of a live outage rather than causing it. The underlying
  exception is still unidentified (see remediate.md), so this finding reports rather than
  removes it.

### F3 - the fix cannot be verified from this repository

class: a defect whose proof of repair lives only in production. Nothing in the tree can
  demonstrate the mobile app recovers until the deployed server runs this code.
sweep: re-run the recorded reproduction after deploy -
  `POST /api/coach/extension/suggest` with a valid Bearer token must return 200 where it
  returned 502, and `POST /api/coach/sales-session/roleplay` must return a readable error or
  200 where it returned an empty 500.
severity: medium - it does not affect correctness, but claiming this build "fixes the app"
  before that probe would be exactly the A38 failure of reporting a subset in the gate's words.
