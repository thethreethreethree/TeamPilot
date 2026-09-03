# CLOSURE — Gamification Phase 4 (manager notifications)

## What shipped
In-app manager alerts, two triggers: a strong session (points at/above the alert line, fired from the after-pitch
generation) and a closed deal (outcome='sold', fired from the outcome route). Recipients = the company's admins /
sales-coach admins (no per-agent manager FK exists — fan out), minus the agent; idempotent via the Phase-1 unique
index; best-effort so neither wire can break its host flow. A notifications route (list + unread + caller-pinned
mark-read) and a NotificationBell (badge + dropdown + mark-all-read) on the Scoreboard (manager-only). 31 tests +
typecheck clean.

## Verification (A38)
`npx vitest run` → 31/31; `npm run typecheck` clean. In check.md.

## The un-named reliance
- Relies on the manager_notifications unique index (recipient_id, type, session_id) so the upsert-ignore is truly
  idempotent across re-scores / re-records / double-fires.
- Relies on the after-pitch + outcome flows being the real trigger sites for strong-session / deal events.

## Residual (A36 — explicit)
```json
[
  {
    "id": "GAM-R8",
    "item": "The bell lives on the Scoreboard page, not the global shell header — so a manager sees alerts when they open Scoreboard, not from anywhere in the app. A global header bell is the better home but the SalesCoachShell layout is complex; a careful placement is a follow-up.",
    "why_skipped": "Editing the shell layout mid-session risked breaking it; the Scoreboard placement is clean, working, and thematically fitting.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T12:35:00+08:00",
    "outcome": "OPEN — move the bell to the shell header (or a top bar) as a focused follow-up."
  },
  {
    "id": "GAM-R9",
    "item": "Notifications poll (60s) rather than realtime. The founder said in-app only and the codebase has no generic notifications realtime channel; polling is the smallest correct choice, but a manager sees an alert up to a minute late.",
    "why_skipped": "Adding a realtime dependency for this feature is explicitly out of scope (plan §5 / founder).",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-03T12:35:00+08:00",
    "outcome": "OPEN — only if sub-minute latency is ever required."
  }
]
```
