# CHECK — full-build audit fixes

## Verification run (A38)
Canonical command: `npm run check`.

## Findings

### A1 — aborted "recording-in-the-beat" reload strands the stale client
file+line: `src/components/system/VersionWatcher.tsx` — `markTriedCommit` ran before the 1.5s beat; a reload
aborted for a recording left the commit marked tried → every later trigger no-ops → auto-update dead for that
commit.
class: auto-update-stranded (defeats the recording-ended safety net).
severity: high
read-path: fixed by writing the loop-guard budget inside the timer, right before `window.location.reload()`.
remediation: see remediate.md A1.
sweep-command: `grep -nE "markTriedCommit|reloadTimerRef|isRecordingActive" src/components/system/VersionWatcher.tsx`
— confirms the budget write is now inside the timer, after the recording recheck, before the reload.

### A2 — single-flight leaves a fast/slow reuse-detection race open
file+line: `extension-sales/background.js` / `extension/background.js` — callers captured the refresh token at
call-start; a slow call 401ing after a fast call rotated it replayed the consumed token → session killed.
class: token-reuse-race (the founder's "kicked out", narrowed not closed).
severity: high
read-path: fixed by re-reading `chrome.storage.local.<refreshTokenKey>` at refresh time in doRefresh.
remediation: see remediate.md A2.
sweep-command: `grep -nE "storage.local.get|refresh_token|RefreshInFlight" extension-sales/background.js extension/background.js`
— confirms doRefresh re-reads the latest token before the grant.

### A3–A6 — manual-reload recording guard, unmount leak, visibilitychange target, restart busy-guard
class: guard-gap-and-lifecycle (four low-med instances: an unguarded manual path, a mount-lifecycle leak, a wrong event target, a UI race)
severity: medium
Lower-severity but real: A3 (manual Reload unguarded mid-call → confirm added), A4 (reload/setState after unmount
→ unmountedRef + timer cleanup), A5 (visibilitychange window→document), A6 (restart raced #sc-out mid-run →
busy-guard). All fixed; see remediate.md. read-path: each reuses existing inputs (recording flag, mount liveness,
toolBusy) — no new external reads.
sweep-command: `grep -nE "unmountedRef|window.confirm|document.addEventListener|toolBusy" src/components/system/VersionWatcher.tsx extension-sales/content.js`

## Accepted (not fixed — reasoned, not dismissed)
Recording-flag-not-refcount (module hard-lock prevents concurrent recorders), private-mode-disables-auto-update
(safe by-design), revisit-dropped-during-poll (degrades gracefully), sales-login-drops-ext (recovers via the
guidance card — LOW, flagged/deferred).

## Tests
```
$ npx vitest run src/components/system/__tests__/VersionWatcher.test.ts
 Test Files  1 passed (1)
      Tests  20 passed (20)
```
The React timers/DOM + the chrome-API extension code are not node-exercisable; syntax-checked (`node --check`, all
pass) and the reload DECISION they funnel into (`shouldForceReload`) has its full suite. Runtime confirmation is
the founder's live check, per the standing extension posture.

## Full gate
```
PENDING — pasted in closure after the run
```
