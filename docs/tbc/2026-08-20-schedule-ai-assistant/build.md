# Build — AI Assistant + clear-schedule

## Reachability (A31) — both directions of every seam

### AI Assistant (command → proposal → apply)
- files: src/lib/schedule/assistant.ts, src/app/api/schedule/assistant/route.ts, src/app/dashboard/schedule/assistant/page.tsx
- write-path: EXISTS. `POST /api/schedule/assistant` (assistant/route.ts) interprets the message and returns
  proposals whose `events` are appended on Apply through `POST /api/schedule/events` (events/route.ts:69,
  `append_schedule_event`). The manager sets it via the text box + per-proposal Apply button. Every proposed
  type (SHIFT_DEFINED, EMPLOYEE_ASSIGNED, EMPLOYEE_UNASSIGNED, TIMEOFF_REQUESTED, TIMEOFF_APPROVED) is accepted
  by that route and its payload validates against eventSchema (confirmed by reading both). human_can_set: true.
- read-path: EXISTS. Appended events → deriveState → the Grid/Schedule surface (grid/page.tsx); the assistant
  also re-reads the roster+shifts+coverage context on every turn so its answers reflect applied changes.
  human_can_see: true.

### AI Assistance entry points
- files: src/components/schedule/ScheduleNav.tsx (first tab), src/app/dashboard/schedule/new/page.tsx (button)
- write-path: EXISTS — both link to /dashboard/schedule/assistant. human_can_set: true.
- read-path: EXISTS — the routed page renders. human_can_see: true.

### Clear the schedule (delete)
- files: src/app/api/schedule/clear/route.ts, src/app/dashboard/schedule/settings/page.tsx
- write-path: EXISTS — `POST /api/schedule/clear` appends SHIFT_CANCELLED for every live shift via the atomic
  apply_schedule_import RPC (cancel-only). Manager sets it via the Settings danger-zone two-step confirm.
  human_can_set: true.
- read-path: EXISTS — the cleared count is returned; the Grid shows the emptied schedule. human_can_see: true.

## Guide-don't-overtake (§3.3)
The AI never auto-writes. interpretCommand returns proposals; evaluateChange attaches the impact; the manager
confirms each with Apply before a single event is appended. Unknown staff → blocked proposal, not a guess.
