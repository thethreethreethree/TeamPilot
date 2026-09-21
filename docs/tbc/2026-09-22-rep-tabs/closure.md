# CLOSURE — the sub-nav was describing the product

## What shipped

Progress | Breakdown | Metrics on the rep dashboard, as a real tablist with arrow keys and one
panel mounted at a time. The Metrics tab is the founder's existing Macro field read. The board's
tie-rule sentence is now manager-only.

## What this build got right, and it was not the code

Opening `TodaysMetricsPager` instead of describing it again. I had called it "a different board,
the 2026-09-04 Macro spec" twice — accurate, and it omitted the one line that answered the
question:

```ts
const PAGES = [{ key: "progress", label: "Progress" }, { key: "metrics", label: "Metrics" }];
```

The sheet's sub-nav was describing something the product already had, in the same words. Three
builds running, reading the source has changed the task; this time it dissolved most of it.

## The un-named reliance

- **That a full-page view reads correctly inside a panel.** `TodaysMetrics` was built as the whole
  screen of a Macro route. It now renders in a tab panel, and nothing here has looked at it.
- **That losing the stacked layout costs a rep nothing.** Three boards on one page was scrollable
  and discoverable; three tabs are neither, for a rep who did not know the other two existed.
- **That the density pass was worth its cost.** It found one dead sentence. It cannot find a layout
  problem, and eight builds have now ended without anything being rendered.

## Residual

```json
[
  { "id": "R1-nothing-has-been-rendered-in-a-browser",
    "item": "Eighth consecutive build. The rep dashboard's whole shape changed today — three stacked boards became three panels — and it is the largest visual change of the session.",
    "why_skipped": "No browser in the loop. The founder chose a density self-audit over a browser check.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T06:50:00Z",
    "outcome": "OPENED, and the honest reading is that the substitute did its job and is not the same job. The pass found one real thing — a sentence about ranking shown to a reader with no ranks — which is exactly what reading markup CAN find. What it cannot find is whether a full-page Macro view looks right inside a tab panel, or whether a rep who lands on Progress ever discovers the other two tabs exist. Both are now live questions that were not live this morning, because a stack is discoverable by scrolling and a tablist is not." },

  { "id": "R2-a-negative-assertion-passes-for-free",
    "item": "Fourth fixture in four builds that asserted something against an input which made the wrong answer unreachable.",
    "why_skipped": "No mechanical check distinguishes a fixture that proves a negative from one that cannot produce a positive.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T06:51:00Z",
    "outcome": "OPENED. Four in four is a rate and the count is a LOWER BOUND — it is four among the units I chose to mutate, and mutation testing is run by hand. Every one of the four reads well and names in its title exactly what it fails to guard, which is what makes them unfindable by review. The question is written down; whether writing it down changes anything is what A30 says it will not." },

  { "id": "R3-a-tablist-is-less-discoverable-than-a-stack",
    "item": "A rep who lands on Progress sees three tab labels. A rep who landed on the old page scrolled past all three boards whether they meant to or not.",
    "why_skipped": "The sheet specifies tabs, and §1.5.4 says a specified experience binds.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T06:52:00Z",
    "outcome": "OPENED, and it is a real trade rather than a free improvement. The stack's cost was scrolling past thirty percentages to reach the third board; its benefit was that a rep could not miss that the third board existed. Tabs reverse both. The sheet settles what to build and not whether the Breakdown will still be read by anyone now that reaching it takes a decision." },

  { "id": "R4-the-Metrics-panel-has-never-been-seen-in-a-panel",
    "item": "`TodaysMetrics` was built as a full-page Macro route with its own period control. It now renders inside a tab panel.",
    "why_skipped": "Reachability and mounting are tested; appearance is not testable here.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T06:53:00Z",
    "outcome": "OPENED. I nearly recorded a specific defect here — that its period control now sits under a second one from the Arena — and checked before writing it: the Arena has none, and Breakdown's is on a different panel. Each panel carries exactly one. That leaves the vaguer and less checkable worry, which is whether a view designed to be a whole screen reads as a section of one." },

  { "id": "R5-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the seventeenth build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T06:54:00Z",
    "outcome": "OPENED. Directly relevant for the third build running: this one turned on opening a file I had twice described from its name. The instruction image is the file I have described from its context and never opened, because I cannot." }
]
```
