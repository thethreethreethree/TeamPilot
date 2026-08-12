# CHECK — secondary forced client auto-update

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — stale clients could stay on an old build indefinitely (capture fix not reaching users)
file+line: `src/components/system/VersionWatcher.tsx` — the watcher detected staleness but only PROMPTED; a client
that ignored the banner (installed iOS PWA resuming an old in-memory bundle) never updated.
class: delivery gap — deployed fixes not reaching running clients. Directly caused the founder's "still persisting"
report (an old client without the persist-on-Stop fix).
severity: high (the first client's capture fix wasn't reaching them).
sweep-command: `grep -rln "window.location.reload\|NEXT_PUBLIC_BUILD_COMMIT\|/api/health" src` — the VersionWatcher
is the SINGLE client-version-convergence point (no other component force-reloads on version); confirmed it's the
only stale-client mechanism, so fixing it here covers every surface (it lives in the global dashboard layout).
remediation: secondary forced auto-update on reopen/revisit, with a recording guard + a once-per-commit loop guard
(see remediate.md).

## Tests
```
$ npx vitest run src/components/system
 Test Files  1 passed (1)
      Tests  7 passed (7)
```
`shouldForceReload` (the safety-critical decision) is locked in both directions: the force (stale + safe) → true;
each guard (match / empty commit / recording / already-tried) → false; a new deploy after a failed reload → true.
The component's IO (sessionStorage, body flag, visibility, reload) is React/DOM and node-untestable (A30 honesty);
the load-bearing branch logic is the pure function, which IS tested.

## Full gate
```
PENDING — pasted in closure after the run
```
