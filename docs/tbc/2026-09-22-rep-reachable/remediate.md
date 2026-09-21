# REMEDIATE

### F1 — the pager's geometry was asserted by nothing

fix: track width, pane width and offset all derive from `PAGES.length`, and a test asserts the
  track is `300%` and each pane is a third — parsed as numbers with a tolerance, since the
  browser's precision for `100/3` is not ours to predict.
gate-or-promise: gate. Both hard-coded literals are now failing mutations, so the version that
  shipped yesterday cannot come back silently. The broader class — a layout invariant jsdom cannot
  observe — is only partly covered: a style string can be asserted, an actual clipped pane cannot.
  What the test proves is that the numbers are consistent with the page count, not that the result
  looks right.
residual: `SNAP_MIN_PX` exists because jsdom reports no layout width. The drag maths is exercised
  against a floor rather than a real viewport, and three panes on a real finger is untested.

### F2 — four pager tests encoded a two-page world

fix: `pageOf` parses the offset and divides by the pane width instead of testing for `-50%`; the
  edge test walks all three panes; the keyboard test moves through Breakdown.
gate-or-promise: gate for `pageOf`, which is the one that mattered — it would have reported page 0
  for every page of a three-pane track and silently passed every navigation assertion in the file.
  Declined for the class: nothing detects a test helper that decodes state from a literal a count
  determines, and this is the eighth instance this session of a test that could not fail.

### R1 of the sweep — the tabs were unreachable

fix: the Breakdown pane went into the pager a rep actually opens, and `RepDashboardTabs` was
  deleted rather than moved, because a second sub-nav over the same three boards is the §2.2 shape
  where no type can see it.
gate-or-promise: declined, with the hole named (A33), and it is the important one.

  Nothing in this repo asks whether a route's audience matches its contents. `managerOnly` is a
  nav flag; `/my-progress` has no server gate at all, so it is neither reachable by reps nor
  actually restricted from them. A gate would need to know who a page is FOR, which is not
  expressed anywhere — the flag says who sees the link, and the page says nothing.

  `reachability:audit` proves a module is imported by something. It cannot prove that the something
  is reachable by the person the module was built for, and that is precisely the gap R1 fell
  through: every module in that build was imported, every test passed, and the route was hidden.
residual: the same question applies to every page added since. Nothing swept them.
