# BUILD — moving the tabs to the surface the rep can open

### The third pane, on the pager a rep actually reaches

- write-path: `TodaysMetricsPager` gains a Breakdown page between Progress and Metrics — the rep
  dashboard sheet's order, and its argument: where you stand, then why, then the field read.
- write-path: **the geometry is now derived from `PAGES.length`.** It was `width: "200%"`,
  `width: "50%"` and `page * 50`. A third pane added against hard-coded halves slides to the wrong
  offset and clips the last one, silently, because the track still looks like a track.
- write-path: `PANE_WIDTH` is a single derived constant, so adding a page cannot leave a stale
  literal behind in one of three places.
- read-path: a rep reaches the Breakdown from their own bottom nav — Today's Metrics — for the
  first time. It existed, it was tested, and it was behind a `managerOnly` route.

### One sub-nav, two routes

- write-path: `RepDashboardTabs` is **deleted**, and `/my-progress` renders the pager.
- write-path: two tab lists over the same three boards is the §2.2 shape somewhere types cannot
  see it — both correct the day they were written, and the first page added to one would silently
  not appear in the other.
- read-path: a manager is also a rep here, so `/my-progress` is their desktop route to the same
  dashboard; the pager's swipe simply goes unused with a mouse.

### The orphan the gate caught

- write-path: deleting the duplicate sub-nav left `PitchMilestones` imported by nothing.
  `reachability:audit` failed the build by name.
- write-path: it is mounted on the Progress pane beneath the Arena, which is where the sheet puts
  it and where it had been.
- read-path: two milestone strips on one pane, deliberately — the Arena's count SESSIONS on the
  points ledger and these count COUNTED PITCHES, so they diverge permanently and merging them would
  mean silently moving earned-at dates the Arena has already shown.
- read-path: this is the gate built this session earning its place. It exists because three modules
  in one feature had no caller on one day, and it caught a fourth created by a refactor.
