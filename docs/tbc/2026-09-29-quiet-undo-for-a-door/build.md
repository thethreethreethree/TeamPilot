# BUILD — a quiet undo for a mis-tapped door

### Server undo appended, never edited

- **write-path:** `POST /api/coach/sales-session/door-log { kind: "undo", knockId | clientKnockId }` →
  `undoKnock()` (`src/lib/data/doorlog.ts`) → insert into `door_knock_undos` (migration 0267), own knock only,
  within 60 minutes; the knock row is never touched.
- **read-path:** `door_knocks_live` = knocks minus undos (`security_invoker = true`). Production, read-only,
  after apply: raw 1227 = live 1227 = rep_kpi_daily 1227, undo rows 0.

### Every count excludes undone knocks

- **write-path:** counting readers read `door_knocks_live` — day-target route ×3, `dayTargetData` ×4,
  `doorlog.ts` presentations ×1; `rep_kpi_daily` redefined over the view (its five readers unedited).
- **read-path:** Postgres 16 probe — undoing a Sold moves live 2→1 and sold 1→0 while raw stays 2; INVARIANT 30
  fails the build if a count reads the raw table.

### Website Door Log offers undo for five seconds

- **write-path:** `DoorLog.tsx` → after a CONFIRMED knock-only log, `offerUndo(id, label)`; tapping Undo posts
  `{ kind: "undo", clientKnockId }` for that same id.
- **read-path:** `DoorLogUndo.render.test.tsx` (4) and the `door-log-undo` capture in both themes — "Logged: No
  Answer · Undo" above the tiles.

### Phone Door Log offers undo for five seconds

- **write-path:** `doors.tsx` → `offerUndo(k.clientKnockId, …)` after `addKnock`; Undo → `markKnockUndone` (still
  on the phone) or `sendUndo` (already confirmed); the sweep drops an unsent undone knock or follows it with a
  server undo.
- **read-path:** `countByOutcome` skips undone knocks; `tests/knock-undo.test.ts` (9) including Undo pressed
  mid-send, and `tests/door-log-undo-screen.test.ts` (5).

### Knock queue serialised

- **write-path:** every read-modify-write in `knock-store.ts` runs inside `mutate()`, per rep.
- **read-path:** `tests/knock-store-concurrency.test.ts` — ten taps racing ten removals keep exactly the ten taps.

```
$ npm test   (app @ 671d9384)
ℹ tests 1571
ℹ pass 1571
ℹ fail 0
exit 0
$ npm run check   (website @ 95c93633)
      Tests  5560 passed | 15 skipped (5575)
exit 0
```
