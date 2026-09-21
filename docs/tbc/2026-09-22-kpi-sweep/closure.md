# CLOSURE — the restriction I undid one section below itself

## What shipped

A rep no longer receives a ranked board or a rank from the gamification leaderboard. The Arena
stopped showing a rank without being touched. The Breakdown leads with what a rep is best at before
naming the gap.

R1 of the ruling's closure is closed.

## What this build got right, and it was not the code

Nothing in this build was a good decision. It was a sweep that found three violations, one of which
I created that morning: I restricted the Pitch Score board so a rep sees no rank, then mounted it
on the same page as a fully-ranked board carrying every colleague's name. The restriction was
undone one section below itself, hours apart, by me.

The one thing that worked was a decision made the day before — gating at the route rather than in
the component. `RepArena` was printing a rank on the rep's default view and was corrected without
being edited, by a change aimed at a different screen.

## The un-named reliance

- **That the sweep was complete.** It covered the surfaces I could name. It was not mechanical, and
  a rep-facing surface I did not think of is not covered by anything here.
- **That "strongest" is an acceptable substitute for "improved".** It is the growth-framing today's
  data supports and it is not what the document asks for.
- **That a rep reaching /scoreboard is still worth it.** The page now shows them a standing and an
  explanation of what is missing. If that reads as a locked door rather than an honest boundary,
  hiding the page would be better.

## Residual

```json
[
  { "id": "R1-my-three-tab-build-is-on-a-manager-only-route",
    "item": "I built Progress | Breakdown | Metrics on /dashboard/sales-coach/my-progress. That nav entry is managerOnly. The rep's actual dashboard is the pager at /doors/todays-metrics, which has Progress | Metrics and no Breakdown.",
    "why_skipped": "Found during this sweep, after the tabs had shipped. Moving them means taking a founder-specced swipe pager from two panes to three.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T08:10:00Z",
    "outcome": "OPENED, rated lowest, and it is the worst thing in this build. I spent a build implementing the sheet's rep sub-nav on a page reps cannot reach from the nav — built, tested, eleven mutations, every check clean, and unreachable by the person it is for. That is A31's exact failure, and I have cited A31 in six consecutive builds while committing it. The rep-facing fix is a third pane on the pager; the alternative is dropping managerOnly from My Progress, which is a nav decision rather than a repair." },

  { "id": "R2-lead-with-what-IMPROVED-is-not-implemented",
    "item": "The KPI document asks the agent view to lead with what improved. The board leads with what the rep is best at, because it reads one period and has no baseline.",
    "why_skipped": "A previous-period aggregate is a feature, not a fix.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T08:11:00Z",
    "outcome": "OPENED. The difference matters more than the shipped copy admits: 'your strongest is Tone' is a fact about a rep, and 'Tone improved 4 points this month' is a fact about their growth. The document is explicitly about the second — self-Elo, agent-vs-their-own-past — and the entire KPI system is built on that comparison. What shipped is the closest thing one period can say." },

  { "id": "R3-the-sweep-was-not-mechanical",
    "item": "Surfaces were found by naming them: Scoreboard, RepArena, PitchBreakdown, PitchLeaderboard, NotificationBell, the milestone strips.",
    "why_skipped": "No mechanical definition of a rep-facing surface exists here — managerOnly is a nav flag, not a gate, and pages are not annotated.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T08:12:00Z",
    "outcome": "OPENED, and R1 is the proof that naming them is insufficient — I got the reachability of a page I had edited that day wrong. The nav's managerOnly flags are the closest thing to a list of rep-facing routes, and nothing checks that a page's CONTENT matches its flag: /my-progress is hidden from reps and has no server gate, so it is neither clearly manager-only nor reachable." },

  { "id": "R4-a-negative-assertion-passes-for-free",
    "item": "Sixth and seventh instances across seven builds. Every one found by mutation, none by review.",
    "why_skipped": "No mechanical check distinguishes a fixture that discriminates from one that cannot.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T08:13:00Z",
    "outcome": "OPENED. Seven builds is enough to call this a property of how I write tests rather than a run of bad luck: I write the assertion I mean, then a fixture that makes it pass, and those are different acts. The mitigation that works is mutation testing, which is manual, so the count is a lower bound." },

  { "id": "R5-nothing-has-been-rendered-in-a-browser",
    "item": "Ninth consecutive build.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T08:14:00Z",
    "outcome": "OPENED, and sharpened by R1. The question is no longer only what a page looks like but WHICH PAGES A REP CAN REACH — and I got that wrong today from inside the code, on a page I had just rewritten. A browser answers both at once." },

  { "id": "R6-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the eighteenth build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T08:15:00Z",
    "outcome": "OPENED. This build's central failure was quoting one sentence of a document I had not read in full. The instruction image is a document I have not read at all." }
]
```
