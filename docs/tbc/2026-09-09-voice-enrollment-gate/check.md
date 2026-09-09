# CHECK — voice-recognition gate, slice 1

## Findings
This build produced **no findings** as defects. Design calls recorded, not hidden: (a) enrollment stores a
pitch NUMBER, never audio, keeping it off the biometric surface; (b) the hard gate is deliberately NOT enforced
this slice (founder rollout choice) so no rep can be locked out; (c) the live mic-capture path is not exercised
here (no microphone) — flagged in closure R2, verified only as pure logic + API + rendered UI.

## Visual verification (LAW 1)
The enrollment component's three states (idle / recording / enrolled) were rendered headless on the dark
dashboard surface and read: gold mic + read-aloud prompt + "Start voice check" (idle); red "Listening…" with a
voiced counter, a gold level meter and a green progress bar, "Done" (recording); green "Voice enrolled · N Hz"
with "Re-enroll" (enrolled). The privacy line ("a number, never a recording of your voice") is prominent. All
legible and on-brand; no visual bug.

## Targeted suites
```
$ npx vitest run src/lib/coach/v5/__tests__/voiceEnrollment.test.ts \
                 src/lib/coach/v5/__tests__/pitchSeparation.test.ts \
                 src/app/api/coach/voice-enrollment/__tests__/route.test.ts
 Test Files  3 passed (3)
      Tests  33 passed (33)   # derive/validate/gate, seedAgentCentroid, and the API contract
```

## Canonical command
```
$ npm run check
  typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test
  invariant audit: 0 violations
  tbc: docs · manifest · artifacts · residual · freshness — clean
  Test Files  627 passed | 1 skipped (628)
       Tests  4148 passed | 15 skipped (4163)
  Duration    70.66s
EXIT_CHECK=0
```

## Deploy precondition (§1.5.3)
Migration `0246` must be applied in prod (`npm run db:apply`) for enrollment to persist. Until it does, the
route degrades honestly (GET → not-enrolled, POST → 503) via `isMissingColumnError` — no outage, but no
enrollment either. Confirm the migration is live before the enforcement follow-up.
