# CHECK — a quiet undo for a mis-tapped door (website half + database)

Branch `feat/quiet-undo-door`. **Not merged**: the website code reads `door_knocks_live`, which does not exist
in production until migration 0267 is applied. Merging first would break every door count on elostate.com.

## The decision

REV 1 removed "Undo last" (app, 2026-09-11). The app's own comment then said a mis-tapped door could not be
taken back anywhere. Picker, 2026-09-29: **"a quiet 'undo' for a few seconds."**

## Design, and why

- **Append, never edit (§3.1).** `door_knocks` has no update or delete policy [OBSERVED]. An undo inserts a
  `door_knock_undos` row (0267); the knock stays on the record.
- **One definition of a counted knock (§2.2).** View `door_knocks_live` = knocks minus undos,
  `security_invoker = true`. `rep_kpi_daily` is redefined over it, which carries its five readers (team
  assessment, pitch-score aggregate, training brief, two in doorlog.ts) without editing them.
- **Counting readers switched** [OBSERVED, classified one by one]: day-target route ×3, `dayTargetData` ×4,
  `doorlog.ts` presentations ×1. **Deliberately not switched:** the knock write and its dedupe lookup; the
  undo's own lookup; and the two "what is today" anchors — an undone knock still dates the rep's day, and
  switching them would show yesterday as today when the only knock today was taken back. Pitch readers that
  embed the knock are not counts and are untouched.
- **Window:** offered for 5 s (`UNDO_MS`); accepted by the server for 60 min (`UNDO_WINDOW_MS`, and
  independently by 0267's insert policy) so an undo from a phone that lost signal for a moment lands.
- **Own knock only.** The lookup filters `rep_id = caller`; a manager who can SEE a rep's knock cannot undo it.
- **Knock-only logs only.** A recorded pitch has uploaded audio by the time it is logged; undoing its knock
  would orphan the pitch in the report card.

## Gates

- **INVARIANT 30** (`scripts/invariant-audit.mjs`): a direct `.from("door_knocks")` is allowed only in listed
  files, with a COUNT per file. Mutations: day-target counting from the raw table again → caught; one extra
  raw read in an already-listed file → caught. Stale allowances fail.
- `rls:audit`: `door_knock_undos` update/delete documented as deliberate; 0 RLS-bypassing views.

## Tests

- `undoKnock.test.ts` (7) — the fake honours table names and filters. Mutations: drop the rep filter → the
  "manager cannot undo" test fails; drop the window → "too_late" fails.
- `door-log/route.test.ts` (+6) — verdict→status mapping; 400 without an id; an undo never creates a knock.
- `DoorLogUndo.render.test.tsx` (4) — the same door is undone (same `clientKnockId`); no offer for a refused
  knock; it goes away on its own; a failed undo says the door is still counted. Mutations: offer on failure →
  caught; never time out → caught.
- The day-target tests passed unchanged when their table was renamed under them — their mocks answer any
  table. That is why INVARIANT 30 is static rather than another test.

`npm run check`: CHECK_EXIT=0, 5,560 passed, invariant violations 0.

## Looked at

**[OBSERVED] door-log-undo.light** — grey raised bar "Logged: No Answer · Undo" (Undo in amber-brown) above the
four tiles, "Ready for the next door", No Answer, Record Pitch. **[OBSERVED] door-log-undo.dark** — same,
bar lifted on black, Undo in bright yellow.

## Also fixed in the file

The Door Log's heads-up notice used bare `text-amber-300` — pale on cream, the class swept from Sales Coach
last week. Split to `text-amber-700 dark:text-amber-300`.

## NOT verified

- ~~Migration 0267 has not run against any Postgres.~~ **Run 2026-09-29 against `postgres:16-alpine` in
  Docker — the image CI uses** (CI does not run on branch pushes, only PRs and `main`). `migration:audit`:
  **265 of 265 apply, 0 failed, 0 newly non-re-runnable.** Behavioural probe on a scratch database (shim, then
  every migration): `door_knocks_live` exists with `security_invoker=true`; `rep_kpi_daily` reads it; 2 knocks
  (1 Sold, 1 No Answer) → live 2, sold 1; after undoing the Sold → **live 1, sold 0, raw door_knocks still 2**.
- ~~The RLS policies were not exercised in Postgres.~~ **Exercised 2026-09-29, as a rep, under RLS**
  (`scripts/sql/probes/0267-door-knock-undos.rls.sql`) — §2.2's drift guard for the rule duplicated in
  undoKnock: own fresh knock **allowed**; own knock 2 h old **refused**; another rep's **refused**; foreign
  company **refused**; edit/delete of an undo **no effect**; rep A then counts **live 2 of raw 3**. The first
  two runs refused EVERYTHING — a broken fixture (the new-user trigger creates profiles with no company, and
  company_id references companies), caught only because case 1 expects "allowed". A probe whose every case
  refuses proves nothing.
- **Not applied to production.** Needs the founder's go-ahead (`npm run db:dry` then `db:apply`).
- The app half is not built yet.
- Nothing seen on a phone.

## Not opened

No image, icon, logo, favicon or graphic asset was touched. Two captures generated and opened.
