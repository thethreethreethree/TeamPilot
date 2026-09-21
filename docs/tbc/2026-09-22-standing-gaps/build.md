# BUILD — how far, without who

### The gaps either side of a rep

- write-path: `gapsAround(rows, repId)` in `leaderboard.ts` — the distance to the reps immediately
  above and below. Pure.
- write-path: **specified.** The rep dashboard sheet's Progress board shows, for a rep at #2:
  *"62 pts behind #1 · 118 pts ahead of #3"*.
- write-path: **adjacent, not the leader.** For a #2 rep the one above IS #1, so the sheet's example
  is ambiguous between the two readings — and the pair only makes sense as neighbours, because the
  second half is unambiguously the rep below. A gap to the leader would also be demoralising by
  construction for everyone outside the top three, which is the opposite of what a progress board
  is for.
- write-path: **null is not zero.** Null means there is nobody there — the leader has nobody above,
  the last rep nobody below. Zero means a dead heat, which a rep level with the person above them
  should be able to see.
- write-path: rounded to one place. The case it exists for is the near-tie: `80.3 - 18.4` really is
  exactly 61.9, but `100.1 - 100` is `0.09999999999999432` — and a near-tie is where a rep reads
  the number most closely.
- read-path: returned to BOTH callers. A manager competes too.

### Distances carry the competition; names would not be allowed to

- write-path: the route returns `gaps` alongside `standing`, and no identities with it.
- write-path: this is what makes it showable at all. `docs/SalesCoach-KPI-System.md` forbids
  cross-agent ranking being how results are framed to an agent — and a distance is not a person.
  The rep still sees no name, no total but their own, and no list.
- read-path: *"62 pts behind the rep above · 118 pts ahead of the rep below"* on the standing card,
  each half rendered only when there is somebody there.
- read-path: a response with no `gaps` field at all still renders the standing card, which is the
  rollout-skew guard the same component already carries for `overrides` and `disputes`.
