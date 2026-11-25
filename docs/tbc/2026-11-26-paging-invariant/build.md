# BUILD - Every paged read ordered by a unique key

No migration. No env keys.

### Any paged read (KPI, coaching metrics, schedule, finance, door log, points, rating, readouts)
write-path: none.
read-path: each page is ordered by a unique key last, so totals and lists include every row exactly once at any size.

### A developer adds a new paged read
write-path: npm run invariant:audit → Invariant 42.
read-path: "A paged read is not ordered by a unique key last" unless it ends with .order("id") or is listed with its key.
