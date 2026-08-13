# CLOSURE — idle auto-update

## What shipped
The forced-update watcher now also applies a held update when the page is genuinely IDLE (no interaction for
`IDLE_AUTO_UPDATE_MS = 90s`) while stale + not recording — closing the last gap where a mobile agent who keeps the
app foregrounded and ignores the banner stayed on a stale bundle (founder: "auto update is a must"). The idle
trigger funnels through the existing guarded `scheduleReload`, so the recording-guard + once-per-commit loop-guard
apply unchanged. Threshold locked to [60s, 5min] by a unit test.

**F2 (full-build audit follow-up):** the idle-update was inert for its OWN target case — `stale` only flipped on
mount/revisit, so a never-backgrounded agent never re-detected a deploy. Added a detect-only foreground poll
(`FOREGROUND_POLL_MS = 120s`) so a foregrounded client discovers staleness → banner + arms the idle-update. The
poll never auto-reloads (an active session is never yanked); the reload still happens via the idle path. Now the
detection fires on mount + revisit + periodic poll, all through the one guarded `check()`.

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
Test Files 404 passed | 1 skipped (405); Tests 2792 passed | 15 skipped (2807)
```
VersionWatcher suite: 20 passed (idle + F2 foreground-poll sanity tests included).

## Residual (A36)
```json
[
  { "id": "R1", "item": "The idle React effect (timer + interaction listeners) is not node-testable; only the threshold constant + the reload decision it calls are unit-tested.", "why_skipped": "Chrome timers/DOM events aren't exercisable in the vitest node env (same posture as the rest of the watcher). The safety is the guard COMPOSITION (scheduleReload → shouldForceReload), which IS unit-tested; the idle effect only triggers it.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-13T21:20:00Z", "outcome": "Opened + assessed: the reloading logic is tested at the chokepoint; the untested part is the idle timer wiring, whose worst case (reload a parked, being-read tab) is minor + reversible." }
]
```

## Un-named reliance
- Relies on `scheduleReload` remaining the single guarded reload chokepoint. If a future edit adds a SECOND reload
  path that bypasses shouldForceReload, the idle trigger (and the others) would lose their guards. The check.md
  sweep-command pins that the idle path uses scheduleReload, not a fork.

## Status
Complete once the gate output below shows exit 0. Founder-authorized ("auto update is a must — build it properly").
