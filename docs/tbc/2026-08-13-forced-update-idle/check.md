# CHECK — idle auto-update

## Verification run (A38)
Canonical command: `npm run check`.

## Findings

### F1 — a foregrounded mobile agent never received the forced update
file+line: `src/components/system/VersionWatcher.tsx` — the watcher auto-reloaded only on reopen/revisit
(visibilitychange); an agent who keeps the app foregrounded and ignores the banner stayed on a stale bundle.
class: stale-client-persists (the recurring "agents see the old version" pain).
severity: high
(The founder made auto-update a hard requirement; a mobile-first team that stays foregrounded was the uncovered case.)
read-path: the idle effect reads NOTHING new from storage/network — it re-uses `liveCommitRef` (set by the health
check) via `scheduleReload`; it only adds an in-memory idle timer + interaction listeners.
remediation: add an idle trigger (`IDLE_AUTO_UPDATE_MS`) that calls the existing guarded `scheduleReload` once the
page is genuinely idle. No new reload logic.
sweep-command: `grep -nE "scheduleReload|isRecordingActive|IDLE_AUTO_UPDATE_MS" src/components/system/VersionWatcher.tsx`
— confirms the idle path funnels through the ONE guarded reload function; no second reload path was introduced.

### F2 — the idle-update can't fire for a never-backgrounded agent (full-build audit, 2026-08-13)
file+line: `src/components/system/VersionWatcher.tsx` — `stale` is set only inside `check()`, which ran only on
mount + visibilitychange→visible. A foregrounded agent who never backgrounds the app never re-detects a deploy →
`stale` stays false → NEITHER the banner NOR the idle-update (which both gate on `stale`) ever fires. The idle
feature was thus inert for its own target case.
class: incomplete-feature (auto-update misses the foregrounded case it was built for).
severity: high
(Directly undercuts the founder's "auto update is a must" for a mobile-first, app-foregrounded team.)
read-path: fixed by a detect-only `setInterval(() => check(false))` — reads the same `/api/health` build.commit,
flips `stale`, arms the idle effect. No new reload path.
remediation: `FOREGROUND_POLL_MS` poll (see remediate.md).
sweep-command: `grep -nE "setInterval|check\(|visibilitychange|FOREGROUND_POLL_MS" src/components/system/VersionWatcher.tsx`
— confirms detection now fires on mount + revisit + the periodic poll, all funneling into the ONE `check()`.

## Tests
```
$ npx vitest run src/components/system/__tests__/VersionWatcher.test.ts
 Test Files  1 passed (1)
      Tests  20 passed (20)
```
The 18 cover shouldForceReload (recording + loop guards — the idle path inherits these), the loop-guard execution
(detection-tested), the throttle bypass, and the new `IDLE_AUTO_UPDATE_MS` sanity band. The idle React timer itself
is not node-exercisable; its safety is the guard composition, unit-tested at the chokepoint it calls.

## Full gate
```
PENDING — pasted in closure after the run
```
