# Session closure — 2026-08-21: capture crisis remediation + incremental audio + hardening

One-place record of a large session. Everything below is **live on elostate.com** and **verify:live 30/30**
(tenant isolation, storage privacy, append-only all intact after the day's changes).

## What shipped, by founder request

### DoorLog / Macro Mode (field app)
- **Mic-optional logging** — a rep without a working mic can now log Sold/Go-Back/etc (was: only "No Answer").
  New `LOG_OUTCOME` state → "Log Pitch" logs the outcome as a knock. `1d0c8197`
- **Honest resilient save** — the "check your connection" banner no longer blames the rep for our-end drops.
  `postDoorLog` refreshes the session on a 401 (expired token) + retries transient 5xx/network; the audio-sign
  step too; failures attributed honestly (network vs server). `1d0c8197`, `9cb98b86`, `6699114e`

### Live Sales Coach — capture crisis (the core issue)
Root cause: capture died on long calls (79% of >15-min calls captured nothing), and my own 08-21 reconnect
change had made it worse. Diagnosed via `scripts/diag-session-health.mjs`; full audit in
`docs/CAPTURE-CRISIS-AUDIT-2026-08-21.md`.
- **P0 — reconnect** (`b2515343`): keeps the recorder + mic alive across a drop (was tearing them down +
  discarding audio); retries instead of latching the session dead; refills budget only after 8s stable; fails
  loud instead of silent-idle. Pure `reconnectPolicy.ts` + a source regression guard.
- **P1 — generation recovery** (`92d4c751`): the backfill regenerates the FULL 5-artifact review set (not just
  the dissect) + the After-Pitch summary (shared `generateAndStoreAfterPitch`, de-dup guarded), for
  never-Stopped/auto-closed sessions. Backfill cron daily → **every 3h** (`d2ac9f7f`).
- **Audio recording — incremental upload** (`622006cd`, `e19676b2`, `58859920`): the recorder uploads a 15s
  chunk during the call → `POST /audio-chunk` → `stitchSessionAudio` concatenates on session end (auto-close
  cron for never-Stopped). Survives ANY ending. Orphan chunks cleaned by the purge cron; storage paths
  single-sourced (route/stitch/purge can't drift). TBC: `docs/tbc/2026-08-21-incremental-audio-upload/`.
- **Smart lock auto-release** (`19f4dba6`): the sticky "I'm speaking" earbud lock now auto-releases on an
  unambiguous customer turn + a loud tappable indicator — fixes the all-"agent" transcript collapse.
- **Attribution source persisted** (`1d1e527c`, migration 0236) — makes the labeling collapse diagnosable.

### Add-agent + team passwords (`ee71e32b` earlier) — LIVE

## Verification
- 3492 unit/integration tests green; typecheck + lint clean; theme/rls/invariant audits clean.
- `verify:live` — all 30 live-prod invariants hold.
- Every commit confirmed deployed on Vercel (health.commit == HEAD).
- KPI aggregation audited CLEAN (paged fetch + pure tested compute) — founder KPIs are trustworthy.

## What's on the founder (in `docs/FOUNDER-ACTION-QUEUE.md`)
1. **Validate with a real call** — make a call, DON'T tap Stop (close the tab like reps do), confirm the
   transcript AND a playable recording land. Run `node scripts/diag-session-inspect.mjs <rep-name>` to verify
   that exact session end-to-end (the one thing unverifiable headless).
2. **Decisions** (neither urgent): WS keepalive · mass backlog recovery · auto-re-transcribe empty-but-has-audio.

## Known residuals (documented, bounded)
- Dead-recorder-on-reconnect seam (rare mobile lock/unlock) → audio plays to the seam; transcript unaffected.
- A never-Stop session whose stitch failed keeps its chunks (out of purge scope); rare, idempotent-retried while active.
