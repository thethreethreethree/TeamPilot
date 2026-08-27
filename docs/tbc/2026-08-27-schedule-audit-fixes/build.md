# BUILD — schedule audit fixes

### A — colour export shows both split shifts (§3.4 / §1.5.4)
- write-path: `gridView.ts` — `WeekCell` gains `segments: WeekCellSegment[]` (all a person's shifts that day,
  earliest-first); `buildWeekGrid` accumulates instead of last-wins. `grid/page.tsx` renders every segment in the
  canvas chip (stacked) AND as its own clickable screen chip.
- read-path: a split shift shows both times on the print/PNG/PDF and the screen; nothing is silently dropped; the
  primary (earliest) matches the CSV's earliest-first, so they agree.

### B — import row cap (§1.5.1 / §3.4)
- write-path: `gridParser.ts` `MAX_GRID_ROWS = 1000`; `upload/preview` + `upload/commit` routes reject a larger grid
  with a graceful 413 BEFORE the rows × headerDates expansion.
- read-path: a huge paste gets an honest "too many rows" 413, never an OOM/opaque 500.

### C + D — authority enforced at the write boundary (§2.2)
- write-path: `events/route.ts` — for EMPLOYEE_ASSIGNED / SWAP_APPROVED, `enforceAssignmentAuthority` builds the eval
  context, existence-checks the shift + assignee (409 on a phantom), runs `evaluateChange`, and rejects an absolute
  violation (422). Overridable concerns (coverage/unavailable) pass through. `maxDuration = 30` for the added replay.
- read-path: a manager can no longer write a double-booking / approved-time-off / over-hours / ineligible assignment
  via the raw route, and a stale/foreign id can't inflate coverage.

### F4 — manager GET honest 403 (§3.4)
- write-path: `events/route.ts` GET gates on `ctx.isAdmin` → 403 for a non-manager (was empty-200 via getCurrentCompanyId).
- read-path: a non-manager gets an explicit permission denial, not a false "empty schedule".

### Assistant empty-LLM honesty (§3.4)
- write-path: `assistant.ts` `parseAssistantReply` — an empty (`""`/whitespace) reply returns an honest system message;
  a non-empty-unparseable reply keeps the rephrase guidance.
- read-path: a starved/empty model reply no longer blames the manager to "rephrase".

### Latent precondition (Agent 3 F2)
- write-path: `events/route.ts` — a ⚠ comment marks where TIMEOFF_REQUESTED / AVAILABILITY_SET / SWAP_REQUESTED must
  bind `payload.employeeId` to the caller WHEN staff self-service ships (not before — the manager-entered model needs
  them open today).
- read-path: the next engineer who wires staff self-service reads the ⚠ comment AT the RQ6 gate — the exact line the
  caller-binding must be added to — instead of re-discovering the cross-member-write gap from an incident.

## Files
- `src/lib/schedule/gridParser.ts` · `upload/preview/route.ts` · `upload/commit/route.ts` (+ preview test) — B
- `src/app/api/schedule/events/route.ts` (+ authorityEnforcement.test.ts, route.test.ts GET) — C/D/F4/F2
- `src/lib/schedule/assistant.ts` (+ assistant.test.ts) — assistant honesty
- `src/lib/schedule/gridView.ts` · `src/app/dashboard/schedule/grid/page.tsx` (+ gridView.test.ts) — A

## Ripple (§6 item 5)
`WeekCell` gained a required `segments` field; both consumers (canvas + screen grid) updated, and the gridView tests'
full-object assertions extended — no other importer constructs a WeekCell (typecheck clean). The events route now
replays the log on assignment writes (DB-heavy, LLM-free) — `maxDuration=30` covers it; a read failure fails LOUD
(503), never a silent skip of the guard. No schema/RPC/migration change. The re-importable CSV export is untouched
(its round-trip constraint keeps one shift per cell + its existing warning).

## Honest limit
Canvas rendering isn't unit-tested (jsdom has no real 2D context); the split-shift MODEL fix is gated, the pixels are
founder visual-verify. The authority enforcement is gated with a mocked derived state; a live end-to-end (a real
double-booking POST returning 422 in prod) is founder visual-verify.
