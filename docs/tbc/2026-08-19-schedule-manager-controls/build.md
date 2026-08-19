# Manager controls — Build

## Built
| path | what | clause |
|------|------|--------|
| `src/lib/schedule/types.ts` | Added `SHIFT_CANCELLED` to `ScheduleEventType` + `SCHEDULE_EVENT_TYPES`. | §6 |
| `src/lib/schedule/eventSchema.ts` | `SHIFT_CANCELLED: z.object({ shiftId })` tombstone payload (mirrors `COVERAGE_REQ_REMOVED`). | §6 |
| `src/lib/schedule/deriveState.ts` | Projector case: `SHIFT_CANCELLED` deletes the shift (and its assignments) from derived state; a later `SHIFT_DEFINED` for the same id re-creates it. Append-only — the log is intact. | §3.1 |
| `src/app/api/schedule/events/route.ts` | `SHIFT_CANCELLED` added to `MANAGER_ONLY_EVENT_TYPES` (a cancel is a manager action, RQ6). | §2.2 |
| `src/app/dashboard/schedule/grid/page.tsx` | Cell-click unassign: the pivot carries `{shiftId,label}` per cell; a shift cell is a button → confirm → POST `EMPLOYEE_UNASSIGNED` → reload. `busyRef` re-entrancy latch; per-cell spinner; intro hint. | §1.5.1 |
| `src/app/dashboard/schedule/layout.tsx` | Manager-only gate: server-side redirect of non-`isAdmin` to `/dashboard` before any schedule page renders. Reuses `getCurrentAuthContext().isAdmin`. | §2.2, §1.5.1 |
| `src/lib/schedule/__tests__/deriveState.test.ts` | +2 tests: `SHIFT_CANCELLED` tombstones the shift; a re-`SHIFT_DEFINED` after cancel re-creates it. | A30 |

## Features (reachability inventory)

### Cell-click unassign
Remove a person from a shift by clicking their cell in the weekly grid.
- write-path: grid cell button `onClick` → `fetch POST /api/schedule/events { type: "EMPLOYEE_UNASSIGNED",
  payload: { shiftId, employeeId } }` → the manager-gated (RQ6) events route validates + appends via
  `append_schedule_event` (company/actor server-resolved) → the `EMPLOYEE_UNASSIGNED` projector case removes
  the employee from `shift.assigned`. human_can_set: YES (a manager clicks a shift cell in the grid).
- read-path: after the append the grid calls `load()` → re-reads `/api/schedule/events` → `deriveState`
  drops the unassigned employee from the shift → the cell re-renders without them; the authority's coverage
  re-check (`coverageAfter`) now sees the reduced headcount. The removal is visible on the very next render.

### Manager-only schedule visibility
Only a manager (isAdmin) may open any `/dashboard/schedule/*` page.
- write-path: not a data feature — it is an ACCESS gate. `layout.tsx` runs on every schedule route; a
  non-`isAdmin` (or unauthenticated) request `redirect("/dashboard")` before the page renders. human_can_set:
  the state it gates is set by the user's role (profiles.role → `isAdminRole`), not by this feature.
- read-path: a manager's request falls through the gate and renders the page; a non-manager never sees the
  page (server redirect, no flash). Verified by the same `isAdmin` predicate the APIs enforce, so a user who
  can't write also can't view — consistent, single-source.

### SHIFT_CANCELLED tombstone (foundation)
Cancel a shift append-only; the projector drops it.
- write-path: `POST /api/schedule/events { type: "SHIFT_CANCELLED", payload: { shiftId } }` (manager-only) →
  validated by `eventSchema` → appended. human_can_set: not yet a dedicated button (this build ships the
  primitive + projector + gate); its first consumers are shift-cancel and the replace-the-week re-import
  (next build). Reachable now via the events route + proven by the projector tests.
- read-path: `deriveState` `SHIFT_CANCELLED` case `delete state.shifts[id]` → the shift is absent from
  derived state (and every consumer: grid, coverage, authority). Locked by 2 deriveState tests.

## Step 7 — Reachability (A31)
Cell-click unassign and the visibility gate are fully human-reachable now (a manager clicks / navigates).
SHIFT_CANCELLED is the primitive + projector + route-gate, reachable via the events API and proven by tests;
its dedicated UI (a cancel button) and the replace-the-week consumer are the next build's residual — the hard
append-only + projector semantics are built and locked first.
