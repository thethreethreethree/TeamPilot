# CLOSURE — secondary forced client auto-update

## What shipped
The VersionWatcher now FORCES the update as a secondary path: the Reload banner stays primary, and if the user
doesn't tap it, the app auto-reloads the next time they reopen/revisit (document hidden→visible — the iOS-PWA-resume
moment where staleness lives). Two guards make the force safe: it never auto-reloads during a live recording (both
sales-coach and CARE voice surfaces flag `data-recording`; the update applies once the call ends), and it reloads
at most once per deployed commit (sessionStorage), so a persistent commit/env drift can't loop. The
safety-critical decision is the pure, unit-tested `shouldForceReload`.

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS)
invariant:audit ✓ — Files scanned 773 · Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
test ✓ — Test Files 400 passed | 1 skipped (401); Tests 2757 passed | 15 skipped (2772)
EXITCODE=0
```
`shouldForceReload`: 7 tests (the force + both guards + false-positive cases). Component IO is DOM/React (node-
untestable) — the load-bearing branch logic is the pure function, which IS tested.

## Residual (A36 — top OPENED)
```json
[
  { "id": "R1", "item": "This converges clients to the current build but does NOT fix the ROOT capture failure (empty STT transcript) — that is the ElevenLabs STT-scope env fix, and it does NOT recover audio never saved on an old client.", "why_skipped": "The STT scope is a key/env change (founder-gated), and audio that was never persisted on a pre-fix client is gone; neither is a client-update concern.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-13T09:40:00Z", "outcome": "Opened + assessed: correctly scoped. This ensures every client HAS the persist fix going forward; the STT scope + the misleading 'X conversation' subtitle are tracked separately." },
  { "id": "R2", "item": "The component's DOM/IO wiring (sessionStorage, body flag, visibilitychange, the recording-ended dispatch) is unit-untestable in node.", "why_skipped": "Standing repo constraint; the branch DECISION is extracted to the tested `shouldForceReload`, and the IO is thin. Real-world verification is the founder reopening a stale PWA.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T09:41:00Z", "outcome": "Opened + assessed: accepted; the safety-critical logic is pure + tested, the IO is thin glue, and the founder's device is the live check." }
]
```

## Un-named reliance
- Relies on `visibilitychange` (hidden→visible) firing on a resumed installed PWA — the standard signal for exactly
  the resume case; and on `/api/health` reporting `build.commit` (unchanged; the watcher already used it).

## Status
Complete; full gate exit 0 (pasted above). Commit the VersionWatcher + both recording surfaces + the test + this
TBC dir with explicit paths, then push. (The uncommitted xz finance edit + the after-pitch subtitle honesty fix are
separate follow-ups, not part of this commit.)
