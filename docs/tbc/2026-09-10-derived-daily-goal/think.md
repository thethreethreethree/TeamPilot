---
started_at: 2026-09-10T15:20:00+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - the daily sales goal decides itself

## Why (the record)
The founder, 2026-09-10, holding the shipped door screen on their phone: it read "No daily goal set yet"
and nothing else. Their words: *"I want the daily goal to be automatically decided by OUR AI system based
on the system logic of the build feature"*, and *"the user interface needs to 100% look like this"*, with
the Door Tracker mockup attached.

The empty state was not a bug. Doc 06 specified a MANAGER-set goal, `rep_daily_sales_goal` is
manager-write by RLS, and the screen correctly refused to invent a target. But nobody had ever set a row -
the table is empty - so every rep in the company opens the app to a panel telling them to ask somebody.
The screen that was built to answer "how many doors today" answers "ask your manager".

## What was measured before anything was designed
Read from production with the service role on 10 September, because the two obvious sources of a goal are
both plausible and both turned out to be empty:

    coaching_sessions with an outcome ............ 0      (73 sessions, none with a result)
    companies.sales_coach_monthly_deal_target .... null
    door_knocks (company) ........................ 613
    door_knocks with outcome 'sold' .............. 38
    pitches (company) ............................ 83
    rep_daily_sales_goal rows .................... 0

A CORRECTION I MADE TO MYSELF, and it is the reason this section lists both tables. I first read
`coaching_sessions.outcome` - 0 of 73 - and concluded there were no sales anywhere, which would have made
a sales-derived goal impossible. That is the WRONG TABLE. The door funnel records its result on
`door_knocks.outcome`, which is what the day-target engine already counts, and there are 38 sales in it.
So the own-sales basis IS reachable; it simply is not reachable for a rep who has not sold a door yet.

The company QUOTA is genuinely unavailable: `sales_coach_monthly_deal_target` is null, so there is nothing
to divide. And `rep_daily_sales_goal` is empty, which is the fact that leaves every rep looking at the
empty panel.

## Understanding
What is not empty is what a rep DOES. 613 knocks is a real record of effort, and the engine already knows
how effort becomes sales: starter ratios of 1 presentation per 4.4 doors and 1 sale per 9 presentations.
The target card already shows a rep that arithmetic forwards. Running it in REVERSE turns their own door
count into the sales those doors imply.

Three bases, in order of how much the rep's own record can carry:

    own-sales     real sales exist: the rate they already achieve, rounded up. "Keep this up."
    own-activity  no sales yet: doors per WORKING day -> the sales those doors imply.
    starter       no activity at all: doc 06's worked example, so a new rep opens a real screen.

DISTINCT WORKING DAYS, never the window length. A rep who worked five days of thirty divided by thirty is
handed a sixth of what they can do and meets it before lunch.

A MANAGER'S ROW STILL WINS where one exists. Deriving is the fallback, not a replacement - a human deciding
a person's target is not something to take away, and the RLS that makes it manager-only is unchanged.

AND THE BASIS IS SHOWN TO THE REP. A target that appears from nowhere is indistinguishable from one
somebody guessed, and the argument of this screen is that it does not guess.

## Ripple (1.5)
- `getOrFreezeDayTarget` now reads the 30-day counts BEFORE settling the goal, because the goal is derived
  from exactly those counts. One extra query for distinct working days.
- The frozen path is unchanged: a target frozen for today never recomputes, so a rep's number cannot move
  under them between two opens. The freeze now stores the EFFECTIVE goal.
- `DayTargetView` gains `goalBasis`; the route returns the view whole, so the app receives it without a
  route change. An older app ignores an unknown field.
- The empty state remains reachable and is not dead code: a 503 before migration 0247, and a frozen row
  from before this change, both still produce it.

## Session-Reads (A22)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-10T15:46:00+08:00",
    "why_it_governs": "Understanding precedes solving - a misdiagnosis fed more capacity produces wrong answers faster.",
    "how_this_build_will_embody_it": "The two obvious designs were tested against production data BEFORE being built, and both turned out to be impossible here; the design followed what was measured." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1022", "read_at": "2026-09-10T15:46:00+08:00",
    "why_it_governs": "Verified is a claim about a command you ran, by its own name, not a summary of what you felt like running.",
    "how_this_build_will_embody_it": "check.md pastes npm run check by name with its exit code, alongside the targeted suite rather than in place of it." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-10T15:45:00+08:00",
    "why_it_governs": "The methodology must be in the tree and read now, not recalled.",
    "how_this_build_will_embody_it": "Every clause below was re-opened for THIS build, after its started_at, rather than carried from earlier in the session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-10T15:45:00+08:00",
    "why_it_governs": "Layer 2 is whether the feature delivers the intended result when a real caller invokes it.",
    "how_this_build_will_embody_it": "The intended result is a rep seeing a target. Tests passing while every rep sees an empty panel is exactly the layer-2 failure this names." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-10T15:45:00+08:00",
    "why_it_governs": "THINK first, then search - and measure rather than assume.",
    "how_this_build_will_embody_it": "The two obvious goal sources were checked against production BEFORE designing, and both were empty; the design followed the data instead of the reasoning." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-227", "read_at": "2026-09-10T15:45:00+08:00",
    "why_it_governs": "A user-specified experience is layer 2, not waivable layer-4 polish.",
    "how_this_build_will_embody_it": "The founder specified the screen exactly, so the visual match is the deliverable rather than follow-up polish - and the one deviation (dots as buttons) is stated out loud rather than filed as done." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-375", "read_at": "2026-09-10T15:45:00+08:00",
    "why_it_governs": "Honesty is the moat - never a fabricated number.",
    "how_this_build_will_embody_it": "The goal is derived from the rep's own record and the derivation is shown to them; where there is no record at all it says it is a starting assumption." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-454", "read_at": "2026-09-10T15:45:00+08:00",
    "why_it_governs": "Item 0 - a choice among courses goes to the founder as a picker with a recommendation.",
    "how_this_build_will_embody_it": "What the mockup's 'Reset the day' control should DO went to the founder as a picker, because zeroing real logged events was not mine to decide." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "466-471", "read_at": "2026-09-10T15:45:00+08:00",
    "why_it_governs": "Citing a label without its content is operating in the language of the discipline while violating it.",
    "how_this_build_will_embody_it": "Each id here was opened for this build; none is cited from memory of what it says." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-607", "read_at": "2026-09-10T15:45:00+08:00",
    "why_it_governs": "The manifest closes the gap between citing at the speed of language and reading at the speed of attention.",
    "how_this_build_will_embody_it": "Every read_at postdates this build's started_at, which is what forced the re-read rather than a carry-over." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-789", "read_at": "2026-09-10T15:45:00+08:00",
    "why_it_governs": "A fix is not complete until the class is encoded in something that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The derivation is a pure module with nine tests, and the behaviour change is pinned by two rewritten tests that previously asserted the empty state." }
]
```
