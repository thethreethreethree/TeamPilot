# CHECK

## Commands run, by the project's own names

```
  Migrations applied:      255
  Failed on a fresh DB:    0
  Not re-runnable (known): 0
  Not re-runnable (NEW):   0

  Missing policies:      0
  Violations:            0
  Unreachable modules:   0

 Tests  4839 passed | 15 skipped (4854)
CHECK_EXIT=0
```

| Command | Result |
|---|---|
| `npm run check` | exit 0, with Postgres reachable |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run migration:audit` | 255 / 0 / 0 / 0 — 0257 applies and re-runs |
| the three suites | 10 + 27 + 13 passed |

## The tests were made to earn their place

19 mutations. **18 caught, 1 proven equivalent.**

**The notifier** (7): ignore-duplicates so a second correction is silently dropped · let
`created_at` default so a refreshed row sorts as old news · do not clear `read_at` · notify the
manager instead of the rep · drop the `qualifying` flag · report a failed write as success — all
CAUGHT. Throw instead of returning false — SURVIVED, and run down below.

**The route wiring** (4): notify before knowing the override succeeded · notify the manager rather
than the rep · send the raw id instead of the rubric label · let a throwing notifier fail the
request — all CAUGHT.

**The bell** (8): manager voice for a correction · drop the lost-qualification clause · always
say it no longer counts · drop the new total · link to the door-log report card · link to the
debrief · blank the list when a read fails · subscribe to INSERT only — all CAUGHT, two of them
only after the tests were fixed (F3 and F4 below).

The one worth naming is **ignore-duplicates**. It is one word in an options object, it is what the
neighbouring writer in this codebase correctly does, and it would mean a rep is told about the
first correction to a pitch and never about any that follow.

## The survivor was run down, not written off

"Throw instead of returning false" survived. The convenient reading is a weak test; the actual
reason is that the throw sits lexically inside the function's own `try`, so its own `catch` returns
false and the observable contract is unchanged.

That is a claim, so it was tested with a control:

| | |
|---|---|
| throw **without** the outer catch | CAUGHT |
| remove the outer catch **only** (control) | CAUGHT |

The control is what makes the first line mean anything: the outer catch is itself pinned by the
throwing-client test, so the tests do constrain this behaviour. N6 is a genuine equivalent mutant.

## Findings

### F1 — the first draft sent the rep to another feature's screen

class: two features sharing a word in a URL. The alert linked to
  `/dashboard/sales-coach/doors/report-card/${session_id}`. That route belongs to the **Door Log**,
  renders `doorlog/PitchDetail`, and takes a `pitchId` — so it would have been handed a session id
  for a different feature's entity.
severity: medium. Not a crash: it renders a page, fails to find the id, and shows nothing useful —
  a rep told their score changed, clicking through, and finding an empty screen. Caught by checking
  the route's params before shipping the link, not by a test.
sweep: `grep -rn "sales-coach/doors/report-card\|/after-pitch" src/ --include=*.tsx` — every hard
  coded link into a feature whose vocabulary overlaps another's. "Pitch" names two entities in this
  product.
fix: `/dashboard/sales-coach/${session_id}`, the session page, which is where `PitchScorePanel`
  and the corrections section actually render. The reason is written next to the link.

### F2 — a throwing notifier would have 500'd a correction that already landed

class: a best-effort side effect whose best-effort-ness lives in the callee. `notifyPitchCorrected`
  catches internally and returns false — but the route awaited it with no guard of its own, so the
  guarantee depended on a promise the route could not enforce. Found by writing the test for it and
  discovering the assertion had to be `rejects.toThrow()`, which documents the wrong behaviour as
  intended.
severity: medium. The failure mode is specific and bad: the score has already moved, the manager
  sees a 500, applies the correction again, and a second override lands in an append-only log on a
  score that was already right.
sweep: `grep -rn "await notify\|await send\|await emit" src/app/api/` — every awaited side effect
  after the primary write. The question for each: if this throws, does the caller learn the primary
  write succeeded?
fix: `try/catch` at the route as well, with the reason stated. The mutation "let a throwing
  notifier fail the request" now fails.

### F3 — a second correction would have arrived late, not live

class: a subscription whose event filter no longer matches how the table is written. The bell
  subscribed to `event: "INSERT"`, which was complete when every notification in this table was an
  insert. The correction notice is an UPSERT: a SECOND correction on one pitch UPDATES the existing
  row. So the first correction arrived instantly and every one after it waited for the 60s poll.
severity: medium, and the direction is what makes it notable — the confusing way round. A rep would
  learn that alerts are sometimes instant and sometimes not, with no pattern they could see.
sweep: `grep -rn 'event: "INSERT"' src/` — every realtime subscription written when its table was
  insert-only. The question for each: does anything upsert or update this table now?
fix: `event: "*"`, with the reason at the call site. The cost is one extra re-fetch echoed back by
  mark-all-read, which writes nothing and keeps the unread badge honest across two tabs.

### F4 — two bell tests could not fail

class: a test whose action does not perform the operation it is testing. "Keeps the last state when
  the read fails" clicked the bell to trigger a re-read — but clicking only toggles the dropdown,
  so nothing re-fetched and the assertion passed against a component that blanked on failure. And
  the realtime assertion was unreachable entirely: the suite mocked `supabaseEnabled: false`, so
  the subscription effect returned early and the behaviour F3 changed was never exercised.
severity: medium. Both were found by mutation, not by reading — E7 and E8 survived, and the
  convenient reading was that both were equivalent mutants. Neither was.
sweep: any test that drives a re-read through a UI control rather than the mechanism that actually
  re-reads, and any suite whose mock disables the subsystem it means to assert.
fix: the poll is advanced with fake timers, and the realtime client is mocked to RECORD what the
  bell subscribes to, so the event filter is asserted rather than assumed.

## What is NOT verified

- **Nothing has been rendered in a browser.** The bell now has 13 render tests, so the dropdown's
  TEXT and links are pinned — but jsdom draws nothing, and the new alert introduces a dot where
  every other row has a glyph. Whether that reads as deliberate or as a missing icon is a question
  no assertion here can answer.
- **The realtime path is asserted, not exercised.** The test proves the bell ASKS for `event: "*"`
  scoped to itself. No socket has connected and no row has arrived over one.
- **No end-to-end run.** No correction has gone from a real override through a real row to a real
  bell.
- **The dot has not been looked at.** It is `bg-brand`, a token used throughout the product, but
  this build rendered nothing.
