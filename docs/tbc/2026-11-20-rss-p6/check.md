# CHECK - RSS Phase 6

## Commands

None. No Node on this machine; `npm run check` was not run. Migration 0281 is not applied (Supabase suspended).
No live AI call was made, so prompt quality (how often callbacks are found, how good the outcome read is) is
unmeasured — the guards only ensure nothing invented survives.

The full `npm run check` output must be appended below before commit.

## Findings (by reading)

- F1: the task link pointed at /dashboard/tasks/:id, which does not exist; tasks live at /dashboard/operations/:id.
  Fixed.
- F2: on door calls (no player) citation chips would have been dead buttons. Fixed: the page passes onSeek only
  for phone/video calls; elsewhere chips are links.
- F3: the ask-coach route now always passes a companyId (it fell back to undefined before, which skipped
  runBrainCall). With controlExempt the gate does not suppress Sales Coach, so behaviour is unchanged, and the call
  is now attributed to the company in the AI cost ledger.

## Addendum 2026-11-20 (append-only)

The gate this file asked for ran in the Phase 7 build, over Phases 0-7 together, with the outputs and exit codes in
docs/tbc/2026-11-20-rss-p7/check.md. Phase 6 code it changed: followThrough.ts (insert, not ON CONFLICT; transcript
paged past 1000 rows).
