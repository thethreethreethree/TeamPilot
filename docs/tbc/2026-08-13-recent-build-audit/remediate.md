# REMEDIATE — full-build audit fixes

## A1 — reload budget spent on an aborted attempt
Root cause: `markTriedCommit(storage, RELOAD_KEY, live)` ran before the 1.5s beat; the beat's recording-abort then
returned without reloading, but the commit was already recorded as tried, so `shouldForceReload` returned false
for every subsequent trigger. Remediation: move `markTriedCommit` INTO the timer callback, after the
recording-recheck, immediately before `window.location.reload()`. The loop guard is preserved (it still persists
across a real reload); an aborted attempt now costs nothing. class: auto-update-stranded. severity: high. Fixed.

## A2 — refresh replays a consumed token (fast/slow)
Root cause: callers capture the refresh token at call-start; the single-flight only coalesces refreshes overlapping
in time, so a slow call 401ing after a fast call rotated the token replayed the consumed one → reuse-detection.
Remediation: `doSalesRefresh`/`doCareRefresh` re-read `chrome.storage.local.<refreshTokenKey>` at refresh time and
use that. A late refresher gets the freshly-rotated token; combined with the single-flight, both the overlapping
and the sequential variant are covered. Boundary (A26): applied identically to both extensions. class:
token-reuse-race. severity: high. Fixed.

## A3 — manual Reload unguarded during a recording
Root cause: automatic reload paths are recording-guarded; the manual button called `window.location.reload()`
directly. Remediation: the onClick `confirm()`s during a live recording ("updating now will end it and lose the
recording"); the mic keeps recording while the rep decides, and the auto-update still applies on call-end. class:
capture-loss. severity: medium. Fixed.

## A4 — reload / setState on a torn-down mount
Remediation: `unmountedRef` set in the effect cleanup; the cleanup also `clearTimeout(reloadTimerRef)`; the beat
returns early if unmounted; check() returns early after its await if unmounted. Low impact (root-mounted) but a
genuine leak, now closed. class: unmount-leak. severity: low. Fixed.

## A5 — visibilitychange attached to the wrong target
Remediation: `document.addEventListener("visibilitychange", …)` (was `window`) — the event fires on document; this
is the load-bearing iOS-PWA-resume revisit path and now matches the rest of the codebase. class: robustness.
severity: low. Fixed.

## A6 — restart races a live run
Remediation: the ↻ restart handler no-ops with "A tool is still running — let it finish, then hit ↻ again" when
`toolBusy` is set, instead of writing a false "pick a tool" while the stream keeps overwriting #sc-out. class:
ui-race. severity: low-medium. Fixed.

## Accepted (not fixed)
Recording-flag boolean (module hard-lock prevents concurrent recorders in one tab); private-mode disables
auto-update (safe by-design tradeoff); revisit-dropped-during-in-flight-poll (degrades gracefully); sales-login
drops `?ext=` (recovers via the guidance card — LOW; deferred, threading ext into state isn't worth it now).
