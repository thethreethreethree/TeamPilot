# CLOSURE — peer-rep IDOR readback gate

## What shipped
An owner-or-manager `getSession()` pre-gate on the three single-session coaching-artifact GET
readbacks (dissect, review, summarize), matching the already-gated POST handlers + the `/why`
sibling, plus an A30 structural guard (`sessionArtifactReadGate.test.ts`) that fails CI on any
future ungated single-session `events` readback. Detection-proven this session.

## Verification (A38) — canonical command + exit code
```
$ npm run check
  … typecheck · lint · theme:audit ·
  ═══ ELOSTATE RLS policy audit ═══   Tables without RLS: 0 · Missing policies: 0
  ═══ Invariant audit ═══   Files scanned: 787 · Violations: 0
      (… every cross-person read gated · every coaching_sessions write scoped …)
  ✓ tbc:docs        2 governing document(s) match the manifest.
  ✓ tbc:manifest    12 manifest entr(ies)
  ✓ tbc:artifacts
  ✓ tbc:residual
  ✓ tbc:freshness
  Test Files  423 passed | 1 skipped (424)
  Tests       2913 passed | 15 skipped (2928)
GATE_EXIT=0
```
(The full transcript of this run is the terminal record for this build; the exit code is 0.)

## Un-named reliance (the half I could have skipped)
- **I relied on `coaching_sessions` SELECT RLS actually being owner-or-manager** (0083/0084). I did not
  re-run a live `SET ROLE` behavioural probe this session — I read the migration text. If that policy were
  ever loosened to company-wide, `getSession()` would stop gating and this fix would silently regress. The
  structural guard checks the CODE calls `getSession`, NOT that the RLS behind it stays owner-or-manager —
  that remains covered by `rls:audit` + the live verify, not by this test.
- **I relied on `events` RLS being company-wide** as the reason subject-only filtering leaks. That is the
  documented model (0004/0103); I did not re-probe it live this session.
- The fix returns 404 (not 403) for a peer, matching the sibling routes' anti-enumeration posture — a
  deliberate choice, not an accident.

## Residual (A36)
```json
[
  { "id": "R1", "item": "coaching_sessions SELECT RLS (owner-or-manager) is read from migration TEXT (0083/0084), not re-probed live with SET ROLE this session.", "why_skipped": "The gate's correctness depends on this policy; rls:audit + the live verify cover the policy itself, and this build's structural guard only asserts the CODE calls getSession, not the RLS behind it.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-15T09:06:00Z", "outcome": "Accepted — the RLS is covered by rls:audit (this gate reported Missing policies: 0); if it ever loosens to company-wide, this fix regresses and that is the layer to watch, not this test." },
  { "id": "R2", "item": "events RLS being company-wide (0004/0103) — the premise of the leak — was taken from the documented model, not re-probed live.", "why_skipped": "Consistent with the invariant audit ('every cross-person read gated') which passed; a live probe would confirm but the model is well-established in the tree.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-15T09:06:20Z", "outcome": "Noted — no behaviour depends on re-confirming it beyond the fix already applied." },
  { "id": "R3", "item": "The other three audit findings (ask-coach injection fence, STT-outage banner, naming-modal trap) were not touched.", "why_skipped": "Founder scoped this build to 'Peer-rep IDOR only'; the rest stay on the audit record for a future decision.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-15T09:06:40Z", "outcome": "Flagged — founder-gated." }
]
```

## Follow-ups (flagged, founder-gated — from the same audit, not selected)
ask-coach injection fence · contradictory STT-outage banner · naming-modal trap + unvalidated subject.
Recorded on the audit; out of scope for "Peer-rep IDOR only."
