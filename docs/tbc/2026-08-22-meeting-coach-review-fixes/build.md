# BUILD — Meeting Coach client review-fix pass (client-only)

### Cross-session cue isolation (findings #1)
- write-path: `start()` (fresh) resets `cueInFlightRef` + bumps `sessionEpochRef` + clears per-session state;
  `invokeCue` captures the epoch at request time and drops the cue if `epoch !== sessionEpochRef.current` at
  delivery.
- read-path: a second meeting's cues fire normally, and a late cue from a prior meeting is never displayed or
  spoken into the new one.

### Bounded reconnect (finding #2)
- write-path: `ws.onopen` schedules a `stableTimerRef` that refills the reconnect budget only after
  `RECONNECT_STABLE_MS`; `ws.onclose` + `teardownTransport` clear the timer.
- read-path: a flapping socket exhausts `MAX_RECONNECTS` and surfaces the "couldn't reconnect" error instead of
  looping forever (no infinite token-mint / AudioContext churn).

### Cue-status feedback (finding #3)
- write-path: `invokeCue` sets `cueStatus` on a forced request (Thinking / failed(HTTP) / nothing-pressing /
  still-listening); the hook returns it.
- read-path: `MeetingCoachingPanel` renders `coach.cueStatus` under the cue box, so "Coach me now" is never a
  dead button.

### Per-session state hygiene (finding #4)
- write-path: `start()` resets `nearingEndRef`, `lastCueAtRef`, `reconnectAttemptsRef`, `currentCue`, `micLevel`;
  `stop()` clears cue + level + status.
- read-path: meeting #2 doesn't inherit #1's "wrapping up" flag, cooldown clock, stale cue text, or frozen meter.

## Reused / mirrored
All four fixes mirror the equivalent guards in `useLiveCoaching` (the sales sibling). Client-only; no sales hook
or server change.
