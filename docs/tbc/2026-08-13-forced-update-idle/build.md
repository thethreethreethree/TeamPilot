# BUILD — idle auto-update

## Features

### Idle auto-update trigger
`src/components/system/VersionWatcher.tsx`: `IDLE_AUTO_UPDATE_MS = 90_000` + an effect (active only while
`stale`) that arms an idle timer and RE-ARMS it on `pointerdown / keydown / touchstart / scroll / wheel` (passive
listeners). On no interaction for the threshold and `!isRecordingActive()`, it calls the existing `scheduleReload`.
Timer + listeners are cleaned up on unmount and whenever `stale` flips.

read-path: the effect reads React `stale` (set when the `/api/health` `build.commit` differs from the baked
`NEXT_PUBLIC_BUILD_COMMIT`) to know a new version exists, then reads the browser interaction events to detect idle,
then — inside `scheduleReload` — reads `liveCommitRef.current`, the sessionStorage loop-guard (`hasTriedCommit`),
and `isRecordingActive()`. It reads NOTHING new that the watcher didn't already read.

write-path: on an idle fire it calls the existing `scheduleReload`, which writes the RELOAD_KEY to sessionStorage
(`markTriedCommit`, the once-per-commit loop-guard) and then `window.location.reload()`. No DB/server write — the
only effect is reloading the client onto the already-deployed build. It is ONLY a trigger; the reload + all guards
live in `scheduleReload` → `shouldForceReload`, unchanged.

GUARD (tested): a mis-set threshold is the feature's footgun — a tiny value would reload-storm an idle-but-being-
read screen. `VersionWatcher.test.ts` locks `IDLE_AUTO_UPDATE_MS` to [60s, 5min]; the reload decision it funnels
into (`shouldForceReload`) already has its full recording + loop-guard suite.
