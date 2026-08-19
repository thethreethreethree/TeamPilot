# Replace-the-week re-import — Build

## Built
| path | what | clause |
|------|------|--------|
| `src/lib/schedule/importPlanner.ts` | `supersededShiftIds(existing, planned)` — pure: the existing shift ids inside the imported date SPAN (min..max) to cancel. The single source of the replace-the-week decision. | §2.2 |
| `supabase/migrations/0223_apply_schedule_import_replace_week.sql` | `apply_schedule_import` gains `p_cancel_shift_ids uuid[] default '{}'` — appends SHIFT_CANCELLED for each id FIRST, in the same transaction as the insert (atomic replace). Default keeps the 3-arg signature working. APPLIED (verify:live 27/27). | §3.1, §1.5.3 |
| `src/lib/schedule/commitImport.ts` | `commitImport` (shared by both commit routes) — derives live shifts, computes the supersede set, calls the RPC; FAIL-LOUD (MIGRATION_REQUIRED) if there's something to supersede but the RPC lacks the param, never a silent append. `readExistingShifts` shared with the preview. | §6, §1.5.3, §2.2 |
| `src/app/api/schedule/upload/commit/route.ts` + `.../va/commit/route.ts` | Both call `commitImport` (was a duplicated RPC block); return `shiftsSuperseded`; map MIGRATION_REQUIRED → 503. | §6 |
| `src/app/api/schedule/upload/preview/route.ts` + `.../va/preview/route.ts` | Add `willReplace` = supersededShiftIds(live, shift-entries).length — the SAME function the commit uses, so the warned count matches. Non-blocking on read failure. | §3.4, §2.2 |
| `src/app/dashboard/schedule/import/page.tsx` | Preview shows "This replaces N existing shifts…" (amber warning) before Import; the done message reports "replaced N existing shifts". | §3.4, §1.5.1 |
| `src/lib/schedule/__tests__/importPlanner.test.ts` | +4 tests for supersededShiftIds (span inclusive, mid-span clear, empty/first-import, single-day). | A30 |
| `src/app/api/schedule/upload/commit/__tests__/route.test.ts` | +2 route tests: replace-week passes the cancel ids + returns shiftsSuperseded; first import supersedes nothing. Mock updated for the new event read. | A30 |

## Features (reachability inventory)

### Replace-the-week re-import
Re-importing a week supersedes that week's existing shifts, then adds the new ones — atomically.
- write-path: import UI Preview → commit route → `planImport` → `commitImport` derives live shifts →
  `supersededShiftIds` → `apply_schedule_import(..., p_cancel_shift_ids)` appends SHIFT_CANCELLED for each in
  the imported span THEN inserts the new shifts, one transaction. human_can_set: YES (a manager re-uploads a
  corrected CSV / VA file and clicks Import).
- read-path: the commit returns `shiftsSuperseded`; the derived state (grid/coverage) shows the replaced week
  with the old shifts gone and the new ones present (the SHIFT_CANCELLED projector drops the old; the new
  SHIFT_DEFINED add the replacements). The grid re-render reflects it immediately.

### Replace warning (pre-commit honesty)
The manager sees how many existing shifts a re-import will replace before confirming.
- write-path: not a mutation — a preview computation. Preview route → `readExistingShifts` + `supersededShiftIds`
  → `willReplace`. human_can_set: shown automatically whenever the previewed import overlaps existing shifts.
- read-path: the import page renders the amber "This replaces N existing shifts" line; because it uses the
  SAME supersededShiftIds the commit uses, the warned N equals what the commit actually supersedes (barring a
  concurrent edit between preview and commit — see check.md).

## Step 7 — Reachability (A31)
Both the re-import and the pre-commit warning are human-reachable now (a manager re-uploads + previews +
imports). The migration is APPLIED, so the path works end-to-end (not code-only). supersededShiftIds and the
route behavior are unit-tested; verify:live re-ran green on the migration.
