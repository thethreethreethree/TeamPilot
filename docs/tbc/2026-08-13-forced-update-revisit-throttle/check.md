# CHECK — reopen/revisit throttle bypass

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — the 30s version-check throttle silently blocked the revisit auto-update
file+line: `src/components/system/VersionWatcher.tsx` — `check()` returned early on the 30s throttle even for a
genuine reopen/revisit, so `scheduleReload()` never ran on a quick return.
class: reliability gap in the forced-update (e6f17db3) — the founder's "auto-update on reopen" missed for returns
within 30s of the last check.
severity: medium (the primary mechanism for the founder's stated goal, intermittently not firing).
sweep-command: `grep -n "lastCheckRef\|30_000\|check(" src/components/system/VersionWatcher.tsx` — the throttle is
the single gate on `check`; the revisit is now the only caller that bypasses it, so no other path is affected.
remediation: `bypassThrottle` param, set on a genuine revisit (see remediate.md).

## Tests
```
$ npx vitest run src/components/system
 Test Files  1 passed (1)
      Tests  7 passed (7)
```
The pure `shouldForceReload` safety decision (loop + recording guards) is UNCHANGED and still passes — the bypass
only affects the THROTTLE, not the guards. The throttle/visibility wiring is React/DOM (node-untestable, A30 honest).

## Full gate
```
PENDING — pasted in closure after the run
```
