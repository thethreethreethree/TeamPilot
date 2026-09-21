# CLOSURE — the loop closes at the rep's end

## What shipped

A rep is told when a manager corrects their score: what changed, what the score became, whether it
still counts, and a link to the page that explains it. R2 of the override-surfaces closure is
closed.

No new table, no second bell, no parallel delivery path — `manager_notifications` was already
structurally generic and `NotificationBell` already read whatever the caller was the recipient of.
The table's name is now narrower than its contents, and the migration says so rather than renaming
it.

## What this build got right, and it was not the code

Reading 0242 instead of remembering it. The table is called `manager_notifications`; a build that
reasoned from the name would have created a second table, a second route and a second component,
and the two would have drifted within a month. Everything good about this build follows from
opening the file.

The second: treating a surviving mutant as a finding by default. Three appeared today — one was a
genuine equivalent and two were tests that could not fail. The convenient reading was available
every time and was wrong twice.

## The un-named reliance

- **That a rep looks at the bell.** It has existed for weeks with nothing in it for a non-manager.
  A rep who has learned it is always empty is a rep who has stopped looking, and this build gives
  them no reason to start beyond the badge.
- **That the payload's shape survives.** The bell renders `item_label`, `total` and `qualifying`
  from a `jsonb` column with no schema. A writer that dropped a key produces a degraded alert, not
  an error, and the test for the empty payload proves it degrades rather than proving it is right.
- **That "told" is what a rep needs.** The rubric requires the change to be LOGGED, and the log
  shipped yesterday. Being notified is my inference from the dispute loop's purpose, not a stated
  requirement — marked as such in think.md, and the founder may think an alert is noise.
- **That one alert per pitch is better than one per correction.** Refreshing the row is a real
  information loss: a rep corrected three times sees one item, not three, and the first two
  reasons are gone from the bell (though not from the pitch).

## Residual

```json
[
  { "id": "R1-nothing-has-been-rendered-in-a-browser",
    "item": "13 render tests pin the dropdown's text and links. Nobody has looked at it. The new alert introduces a DOT where every other row has a glyph.",
    "why_skipped": "No browser in the loop, and LAW 1 forbids placing a glyph this session has not opened and described.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T00:55:00Z",
    "outcome": "OPENED because it ranks highest, and the reading changes it. The dot was chosen to COMPLY with LAW 1 — I could not render a candidate icon, so I used styling instead — and the honest consequence is that a rep's alert now looks structurally different from every other row in that list, for a reason that is about my constraints rather than about the alert. It may read as deliberate emphasis. It may equally read as an icon that failed to load, which is the most common way a missing glyph presents. That is a founder judgement and it is one glance." },

  { "id": "R2-refreshing-loses-the-earlier-reasons-from-the-bell",
    "item": "A second correction to one pitch updates the existing alert rather than adding one. A rep corrected three times sees one item carrying the latest total, and the first two reasons are not in the bell.",
    "why_skipped": "The alternative is a pile of near-identical alerts for one pitch, which is how a notification list stops being read at all.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T00:56:00Z",
    "outcome": "OPENED, and it is a real trade rather than a free win. What makes it defensible is that nothing is LOST — every override is on the pitch detail with its own reason, append-only, and the alert is a pointer rather than the record. What makes it imperfect is that the pointer says 'a manager made a correction' when three were made, and the rep has no way to know that from the bell. Naming the count in the copy would cost one payload field and was not done." },

  { "id": "R3-a-rep-may-have-stopped-looking-at-the-bell",
    "item": "The bell has been visible to reps and empty for them since it shipped. This build is the first thing that puts anything in it for a non-manager.",
    "why_skipped": "Nothing to build — it is a question about habit, not code.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T00:57:00Z",
    "outcome": "OPENED. This is the weakest link in the chain the whole build exists to close, and it is invisible from inside the code: every test passes, the alert is delivered, and the rep never clicks a control they have learned is always empty. The unread badge is the only counter-pressure. Whether it is enough is a question for the first week of real use, not for a test." },

  { "id": "R4-realtime-is-asserted-not-exercised",
    "item": "The test proves the bell ASKS for event '*' scoped to itself. No socket has connected, and whether the table is in the Supabase realtime publication is dashboard config this repo cannot hold.",
    "why_skipped": "No environment to connect one.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T00:58:00Z",
    "outcome": "OPENED. The inherited dependency is the interesting half: the INSERT subscription had the same requirement and has presumably been working, so the publication is probably configured — but 'probably, because something adjacent works' is the §1.5.3 external-config reasoning this constitution has already paid for once. The failure mode is soft: alerts arrive on the 60s poll instead of instantly, which nobody reports as a bug." },

  { "id": "R5-being-told-is-my-inference-not-a-requirement",
    "item": "The rubric requires the change to be LOGGED, which shipped yesterday. That the rep should be NOTIFIED is my reading of the dispute loop's purpose.",
    "why_skipped": "The founder directed the remaining items be finished rather than asked about.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T00:59:00Z",
    "outcome": "OPENED. Rated lowest deliberately: this is the second build in two where I have acted on an inference about what a rep should experience rather than on a stated requirement — the other being the leaderboard access split. Each is defensible alone. Together they are a pattern worth the founder seeing, because the cumulative effect is a product shaped by my judgement of what is humane, in a system whose KPI document has explicit views about exactly that." },

  { "id": "R6-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the twelfth build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T01:00:00Z",
    "outcome": "OPENED, unchanged, and now directly relevant rather than merely outstanding: this build made an icon decision under LAW 1 (R1) and deferred to styling because no render was available. The same constraint that keeps the image unread shaped a visible product choice today." }
]
```
