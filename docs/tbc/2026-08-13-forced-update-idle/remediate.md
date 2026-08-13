# REMEDIATE — F1 foregrounded mobile agent stays on a stale bundle

## F1 — the forced update never reached a foregrounded, banner-ignoring agent
Root cause: the watcher's automatic path fired only on reopen/revisit (`visibilitychange` hidden→visible). A
mobile-first agent who keeps the app in the foreground and doesn't tap the Reload banner never triggers it, so a
stale bundle persists — the exact "agents see the old version" failure the forced-update exists to kill. The
founder made auto-update a hard requirement.

Remediation:
1. `IDLE_AUTO_UPDATE_MS = 90_000` + an effect (while `stale`) that arms an idle timer, RE-ARMED on any
   `pointerdown/keydown/touchstart/scroll/wheel`. On no interaction for the threshold + not recording → call the
   existing `scheduleReload`. Idle-only, so active work (typing, reading-while-scrolling, running a tool) is never
   interrupted.
2. No new reload logic — the idle timer only TRIGGERS `scheduleReload` → `shouldForceReload`, so the recording-guard
   and the once-per-commit loop-guard apply unchanged.
3. Threshold locked to [60s, 5min] by a unit test (footgun: a tiny value reload-storms).

Boundary (A26): this changes client reload behavior for EVERY VersionWatcher consumer (dashboard + sales coach),
but only when stale + idle + not recording. The tiny live engines / active users are unaffected (any interaction
re-arms). The idle React timer is not node-testable; the guard composition it calls IS.

Outcome: fixed (high confidence — reuses the tested guarded reload chokepoint). class: stale-client-persists.
severity: high.

## F2 — foregrounded agent never re-detects a deploy (audit follow-up)
Root cause: `stale` is set only by `check()`, called only on mount + revisit — so a never-backgrounded agent
never re-detects, and BOTH `stale`-gated paths (banner, idle-update) stay inert. The idle feature was inert for
its own target case.

Remediation: a detect-only foreground poll — `FOREGROUND_POLL_MS = 120_000` + `setInterval(() => check(false))`
in the mount effect (cleared on unmount). `check(false)` DETECTS only (flips `stale` → banner + arms the idle
effect); it never auto-reloads, so an active foregrounded session is never yanked by the poll. The actual reload
still happens via the idle effect → `scheduleReload` (recording + loop guards intact). Sanity-tested:
FOREGROUND_POLL_MS > HEALTH_CHECK_THROTTLE_MS and within [60s, 5min].

Boundary (A26): every client now polls /api/health every ~2min while foregrounded (background tabs throttle the
interval). /api/health is a cheap env read — no LLM/DB — so the added load is negligible even at scale.

Outcome: fixed. class: incomplete-feature. severity: high.
