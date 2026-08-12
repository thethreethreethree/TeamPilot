# BUILD — secondary forced client auto-update

## Feature inventory
### The VersionWatcher now FORCES the update (secondary path) instead of only prompting
- write-path: none (client-side reload mechanism). N/A.
- read-path: the watcher READS `/api/health` (`build.commit`) with `cache: no-store` and compares it to the baked
  `NEXT_PUBLIC_BUILD_COMMIT`; on a mismatch it READS `document.body[data-recording]` (guard 1) and
  `sessionStorage[elostate-vw-reloaded-for]` (guard 2) to decide via the pure `shouldForceReload`. All three reads
  feed one decision; exercised by the `shouldForceReload` unit tests + the body-flag wiring in both recording surfaces.
- behaviour: on stale detection the banner shows (PRIMARY, manual "Reload"); on a genuine reopen/revisit (document
  hidden→visible — the iOS-PWA-resume moment) the watcher auto-reloads (SECONDARY), unless held by a guard. The
  banner text reflects state ("A new version is available." vs "Updating to the latest version…"). Reachable by
  any stale client; the safety decision (`shouldForceReload`) is unit-tested.
- guard 1 — a live recording holds the auto-reload: LiveCoachingPanel (`live`) + CARE useVoiceMode (`voiceMode`)
  set `document.body[data-recording]="1"`; on stop they clear it + dispatch `elostate:recording-ended` so the held
  update applies once the call ends.
- guard 2 — reload at most once per deployed commit (sessionStorage keyed on the live commit); persistent drift or
  unavailable storage → no auto-reload (manual banner remains). No loop.

## Files changed
- src/components/system/VersionWatcher.tsx — force auto-update on revisit; `shouldForceReload` pure decision + the
  two guards + the reloading/stale banner states.
- src/components/system/__tests__/VersionWatcher.test.ts — 7 tests on `shouldForceReload` (force + both guards +
  false-positive cases).
- src/components/sales-coach/LiveCoachingPanel.tsx — set/clear the `data-recording` flag + dispatch recording-ended.
- src/components/care/voice/useVoiceMode.ts — same recording flag for CARE voice calls.

## Holistic (§1.5.1)
Client-side only; no server/schema change. Both recording surfaces are guarded. Does NOT fix the root STT capture
failure nor recover already-lost audio (section 4 of THINK) — it converges every client to the current build.
