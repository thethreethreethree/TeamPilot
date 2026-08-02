# Proposal — Auto-close coaching sessions (DB lifecycle + metric completeness)

**Status:** design-ready, awaiting founder go (session-lifecycle + status-semantics decision → §3.3).
**Date:** 2026-08-02
**Trigger:** Live read-only query found **95 of 112 coaching sessions (85%) stuck `status='active'`,
`ended_at` NULL**, aged 29–102+ hrs. Setting `status='ended'` requires a SEPARATE manual finish+name step
(`[id]/page.tsx:234` → PATCH `{status:'ended'}`), distinct from the live `stop()` (which only halts the
stream). Reps stop the call but skip finish → sessions never close in the DB.

## Why it matters (three consequences, one root cause)
1. **Data quality:** 85% of sessions never reach a terminal state — the dominant outcome.
2. **§3.5 metric completeness (DISTINCT from the 1000-row truncation):** `avgSessionDurationMin` needs
   `ended_at` (null for 85%), and `sales-session/dashboard` + `team-analytics` filter `status='ended'/'reviewed'`
   — so those views and the duration metric reflect only ~15% of sessions.
3. Root cause: session *lifecycle close* is coupled to the *finish+name/After-Pitch* enrichment step, so
   skipping enrichment leaves the session open forever.

**Scope note (verified):** C.A.R.E support conversations do NOT have this (73% terminal) — it is
coaching-specific. And much of the 95 is likely test churn during active dev (1 company / 3 agents) — but the
auto-close gap is real regardless.

## NOT the same as the cost cap (keep them separate)
This is about the **DB record + metrics**. The STT *cost* is already bounded by browser-disconnect (`stop()`
closes the websocket; tab-close kills it). The uncapped-*streaming*-cost of a foreground-idle session is the
SEPARATE `"cap live-coaching sessions"` flag (an idle-timeout on the stream). They share a theme but fix
different things; this proposal does not bound streaming cost.

## Design — decouple "ended" (lifecycle) from "named/reviewed" (enrichment)

The core decision: **a session should reach `ended` when its live run stops, independent of whether the rep
did the finish+name/After-Pitch step.** Naming/review becomes optional enrichment on an already-ended session.

Two composing mechanisms:

### A. Client-side auto-close on `stop()` (primary)
When the live coaching stream stops — user Stop, or unmount/navigate-away (both already call `stop()` in
`useLiveCoaching.ts`) — PATCH the session to `status='ended'` (stamping `ended_at`) if it is still `active`.
The existing finish+name flow then operates on an already-ended session (rename/After-Pitch as enrichment),
rather than being the ONLY path to `ended`.
- **Guards:** forward-only status (the `check (status in ('active','ended','reviewed'))` + a
  `active→ended→reviewed` state machine); owner-scoped PATCH (the session's rep — the existing `[id]` PATCH
  route is owner-gated); idempotent (`.eq('status','active')` so a double-fire is a no-op).
- **Risk:** touches the live-untested realtime hook — add the PATCH in `stop()`'s teardown, after the socket
  close, guarded so a failed PATCH can't throw out of teardown (log + continue). Runtime-verify with a real
  call before trusting it.

### B. Server-side stale-session sweep cron (backstop)
A cron that marks any session `active` for > N hours (e.g. 6h — beyond any real call) as `ended` (or a new
`abandoned` status), catching cases where `stop()` never fired (crash, lost network, hard tab-kill).
- Mirrors the existing cron pattern (CRON_SECRET gate, service-role, `bounded` flag). N is a founder threshold.
- This is the durable backstop; A alone misses hard-crash cases.

### C. One-time cleanup of the existing 95
A one-shot (script or migration) to mark the current stuck `active` sessions `ended`/`abandoned` with
`ended_at = coalesce(last_segment_time, started_at)` so the metrics recover. Distinguish real from
test-churn if possible (or just close all, given the pilot is internal).

## Founder decisions this needs
1. **Status semantics:** does an auto-closed-but-un-named session become `ended` (recommended — decouples
   lifecycle from enrichment), or do you want a distinct `abandoned` status to separate "rep finished" from
   "rep walked away"? The latter is more honest for the §3.5 metrics but adds a status.
2. **Stale threshold N** for the backstop cron (recommend 6h).
3. **Cleanup:** close all 95 existing, or only the clearly-abandoned?

## What this unlocks
- Duration + status-filtered §3.5 metrics reflect ALL sessions, not 15%.
- No more open-session pile-up.
- A clean lifecycle the KPI aggregation fix can rely on.

**Green-light phrase:** `"auto-close coaching sessions"` (± your status-semantics + threshold choices).
