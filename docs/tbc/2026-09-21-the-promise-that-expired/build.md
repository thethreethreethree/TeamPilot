# BUILD

### Pattern Interrupt route and screen

Project 5's surface: the shell, the manager/rep split, the explainer, and an empty state that
shows zeros with a stated reason rather than the mockup's sample numbers. Rendering "12 active
patterns, Humza Khan at 5 of 7" would put fabricated coaching about named reps in front of their
manager, which is the failure this product exists to prevent.

- **write-path:** nothing is written. The screen holds no mutation and issues no request; the
  counts are literal zeros. This is deliberate and is the feature — `patterns` and
  `pattern_events` do not exist (migration 0252 defers them to this project), so there is nothing
  to write and no detector to write it.
- **read-path:** `/dashboard/sales-coach/pattern-interrupt` renders `<PatternInterrupt />` inside
  `SalesCoachShell`, which supplies the nav and the access gate. Role-branching rather than
  manager-only: a manager gets the Patterns / Rep progress tabs, a rep gets the Patterns screen
  scoped to themselves, so neither role clicks a nav item that bounces them. `useIsSalesCoachManager`
  decides which, and the tab row is hidden for a rep rather than rendered with one option.

### The expired dependency, corrected

- **write-path:** `PatternInterrupt.tsx` — the docblock now records that the Pitch Score engine
  landed in 0252, that its per-element grades (`pitch_score_elements`, indexed
  `(company_id, element_id)`) are the input a detector needs, and that what remains is the
  detector plus the two tables 0252 explicitly deferred. The old claim is quoted and dated rather
  than deleted, so a reader learns the note was wrong and not merely what it now says. The
  "WHAT LANDS WHEN PROJECT 1 IS DONE" heading became "WHAT THE DETECTOR MUST DO", since Project 1
  is done.
- **read-path:** the empty state on screen no longer promises a manager that the page fills in
  when scoring goes live. It says scoring is live, the comparison that turns repeated misses into
  a tracked pattern has not been built, and *"nothing is wrong with your team; nothing has
  looked."* The distinction between "none found" and "not looked yet" is the one a manager acts
  on.

### Sidebar regrouped to the 2026-09-19 boards

Six destinations moved group and four changed role flags. Nothing was deleted and every
destination is still reachable.

- **write-path:** `SalesCoachShell.tsx` — Manager Dashboard narrows to the three items the boards
  draw (Coach Assessment, Score Calibration, Pattern Interrupt). A new **My Coaching** group
  collects every surface that shows a rep their own work: My Progress, Pattern Interrupt, Role
  Play, Analytics, Sessions, Training. Team Tools becomes the shared-utility group. A `badge`
  field renders the boards' yellow "NEW" pill; it is decorative and gates nothing.
- **read-path:** `My Progress` appears twice with complementary flags — `repOnly` under My
  Coaching, `managerOnly` under Team Tools — so each role sees it once, in the group its board
  puts it in. Checked two ways: the reachability audit is clean (its line is in check.md, with the
  gate's exit code), and the role flags at every duplicated entry are complementary rather than
  overlapping.
