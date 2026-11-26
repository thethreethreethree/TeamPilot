# REMEDIATE

Caught by the invariant audit before commit, fixed in this build: the first draft wrote snapshots with `upsert`
(ignoreDuplicates). The table's append-only rule makes Postgres refuse any ON CONFLICT insert, so every nightly write
would have failed. It now reads the day's stored rows, inserts the rest, and treats a racing 23505 as already there
(row by row). The probe's plain inserts (service insert ok, duplicate 23505) are the path now used.
