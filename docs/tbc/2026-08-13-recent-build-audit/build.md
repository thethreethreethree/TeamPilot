# BUILD — full-build audit fixes

## Features

### Auto-update reload-budget + safety fixes (VersionWatcher.tsx)
A1: `markTriedCommit` moved INTO the reload timer, right before `window.location.reload()` — the once-per-commit
budget is spent only on an ACTUAL reload, not on an attempt aborted for a recording. A3: the manual Reload button
now `confirm()`s during a live recording so a reflexive mid-call tap can't destroy the recording. A4: an
`unmountedRef` + a `clearTimeout(reloadTimerRef)` in the effect cleanup + guards in the beat and after the async
check() prevent a reload/setState on a torn-down mount. A5: `visibilitychange` moved from `window` to `document`.

read-path: the fixes read the same inputs as before — `liveCommitRef`, `isRecordingActive()`
(`document.body.dataset.recording`), the sessionStorage loop-guard, `/api/health` build.commit — plus
`unmountedRef` (mount liveness). No new external reads.
write-path: `markTriedCommit` still writes `sessionStorage[RELOAD_KEY]=live` (now only right before an actual
reload, so it still survives the reload for the loop guard); the manual button writes nothing until the user
confirms; cleanup clears the pending timer. No DB/server write — the only effect remains reloading the client onto
the already-deployed build.

### Extension refresh reuse-race fix (extension-sales/background.js, extension/background.js)
A2: `doSalesRefresh`/`doCareRefresh` now RE-READ the latest refresh token from `chrome.storage.local` at refresh
time instead of using the token the caller captured at call-start. Closes the fast/slow variant of the
reuse-detection race the single-flight latch alone left open.
read-path: `chrome.storage.local.get(<refreshTokenKey>)` at the top of doRefresh (the freshly-rotated token).
write-path: the refresh grant + `chrome.storage.local.set({<token>, <refreshToken>})` — unchanged, now keyed off
the re-read token so a late refresher never replays a consumed one.

### Extension restart busy-guard (extension-sales/content.js)
A6: the ↻ restart handler now no-ops with a "still running" note when `toolBusy` is set, instead of racing #sc-out
and showing a false "pick a tool".
read-path: the `toolBusy` latch (in the panel IIFE scope). write-path: writes a guidance string to #sc-out and
returns early; no session/storage mutation while a tool runs.
