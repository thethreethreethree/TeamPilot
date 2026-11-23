# BUILD - Message adoption on trackers

No migration. No env keys.

### See whether a message lands
write-path: none.
read-path: Remote Sales → Trackers → a tracker's "Adoption" → TrackerAdoption → GET
/api/coach/remote/trackers/[id]/adoption?days=30|90 → caller's client: the tracker; remote calls since max(created_at,
window) (paged); per 100 calls, stats versions and this tracker's hits (paged) → computeAdoption (adoption.ts) → share
of calls that said it, weekly bars, per-rep table (alphabetical), and the count of calls not analyzed yet.

### All messages on one board (addendum 2026-11-23, ledger F18.1)
write-path: none.
read-path: Remote Sales → Trackers → "How often each message is said" (AdoptionBoard.tsx) → GET
/api/coach/remote/trackers/adoption-board?days= → readAdoptionInputs (adoptionRead.ts, shared with one tracker's view)
for all active trackers at once → computeAdoption per tracker from its own start → share, calls, goal, status; selecting
a message opens its Adoption view.
