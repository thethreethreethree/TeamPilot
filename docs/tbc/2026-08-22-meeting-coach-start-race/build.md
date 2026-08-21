# BUILD — Meeting hook start() Stop-during-setup guard (client-only)

### Stop-during-setup guard
- write-path: `useMeetingCoaching.start()` now returns `teardown()` if `stoppedRef.current` (as well as
  `unmountedRef.current`) after each setup await (getUserMedia / token / ctx.resume).
- read-path: tapping Stop during startup tears down cleanly — no zombie ctx/ws is built and status does not flip
  to "live" on a stopped session.

## Scope
Meeting hook only (new code, zero sales risk). The identical shared pattern in `useLiveCoaching` (the live sales
hook) stays FILED for a coordinated, founder-aware pass — not touched under the build guard (§5).
