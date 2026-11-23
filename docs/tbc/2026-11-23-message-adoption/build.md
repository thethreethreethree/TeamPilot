# BUILD - Message adoption on trackers

No migration. No env keys.

### See whether a message lands
write-path: none.
read-path: Remote Sales → Trackers → a tracker's "Adoption" → TrackerAdoption → GET
/api/coach/remote/trackers/[id]/adoption?days=30|90 → caller's client: the tracker; remote calls since max(created_at,
window) (paged); per 100 calls, stats versions and this tracker's hits (paged) → computeAdoption (adoption.ts) → share
of calls that said it, weekly bars, per-rep table (alphabetical), and the count of calls not analyzed yet.
