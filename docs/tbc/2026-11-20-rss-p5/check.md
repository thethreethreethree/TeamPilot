# CHECK - RSS Phase 5

## Commands

None. No Node on this machine; `npm run check` was not run. Migration 0280 is not applied (Supabase suspended).

The full `npm run check` output must be appended below before commit.

## Findings (by reading)

- F1: the library let whoever added an item keep playing it after the reporting tree stopped letting them see the
  rep. Fixed: playback for non-reps comes from the tree (or consent) only.
- F2: reps on desktop had no way to reach the library (Sessions is not in their sidebar by ruling). Fixed: the save
  confirmation links to it.
