# CLOSURE — the board that was a tab

## What shipped

A rep sees how far they are from the reps immediately above and below them, in points, with no
names. `gapsAround` is pure, the route returns it to both callers, and the standing card renders
each half only when there is somebody there.

## What this build got right, and it was not the code

Opening the sheet before building the thing my own status page said to build. There was no board to
build — the sub-nav has three tabs and the sheet has four pages, none of which is Metrics — and
what turned up instead was a specified, buildable line I had walked past twice.

The summary I was about to build from was **mine**. That is worse than the two-systems map: a
document I wrote the same day, from a source I had opened for other rows and not for that one.

## The un-named reliance

- **That the sheet is the whole specification.** Four pages. If a Metrics page exists in another
  file I have not opened, F2 is wrong in the opposite direction and the tab is specified after all.
- **That "the rep above" is an acceptable substitution for "#1".** The sheet names the rank; I named
  a relationship, because a rank identifies a position a person holds. A rep who knows the board
  size and their own rank can often infer who that is anyway, so the protection is thinner than it
  reads.
- **That a rep wants to see the gap below them.** "118 pts ahead of the rep below" is on the sheet.
  It is also the half that turns a progress board into a defence of position, and nothing here
  tested whether that is motivating or corrosive.

## Residual

```json
[
  { "id": "R1-the-metrics-tab-has-no-contents",
    "item": "The sheet's rep sub-nav is Progress | Breakdown | Metrics, and there is no Metrics page in it. My status artifact listed a 'Today's Metrics board' as remaining work; that was read off a tab label.",
    "why_skipped": "Building it means inventing a whole surface. One build ago, inventing two badge DEFINITIONS from their names was wrong twice out of four.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T04:50:00Z",
    "outcome": "OPENED. Rated lowest because it is the only remaining item that is genuinely blocked on the founder rather than on my time, and because it has been mis-stated in an artifact they have read. The honest position: I do not know what belongs on that tab, the sheet does not say, and the nearest thing in the product is a different section built to a different spec. Anything I put there would be a guess presented as a build." },

  { "id": "R2-the-wording-is-mine-not-the-sheet's",
    "item": "The sheet says '62 pts behind #1'. This says '62 pts behind the rep above'.",
    "why_skipped": "Naming the rank identifies the position another person holds, which sits badly with the access split recorded in section L.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T04:51:00Z",
    "outcome": "OPENED, and the protection is thinner than the substitution implies. A rep who knows the board size and their own rank can work out that the rep above is #1 whenever they are #2 — which is exactly the case the sheet illustrates. So the wording change costs the founder's chosen phrasing and buys less privacy than it appears to. It is defensible as the more conservative of two readings and it is a judgement about their product, made without asking." },

  { "id": "R3-the-gap-below-may-be-the-wrong-half-to-show",
    "item": "'118 pts ahead of the rep below' is on the sheet and is built. It is also the half that frames the board as a position to defend rather than a target to reach.",
    "why_skipped": "It is specified, and §1.5.4 says a specified experience binds.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T04:52:00Z",
    "outcome": "OPENED. The KPI document's stated fear is a system that becomes a stress machine, and a cushion you can lose is a different psychological object from a gap you can close. Both are on the sheet, so both are built — but this is the third thing in two builds where the sheet and the KPI document pull in opposite directions, and I have resolved all three myself. That accumulation is the thing worth the founder's attention, not any single one." },

  { "id": "R4-nothing-has-been-rendered-in-a-browser",
    "item": "Sixth consecutive build. The standing card now carries an ordinal, a total, a two-part gap line, a prize-eligibility warning and a truncation notice.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T04:53:00Z",
    "outcome": "OPENED because it ranks highest and the ranking is now the finding. Five of the six lines on that card were added today, each individually justified, none seen together. A card that says five things says nothing — and the specific risk is that the gap line, which is the actionable one, sits below a warning and above a caveat." },

  { "id": "R5-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the fifteenth build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T04:54:00Z",
    "outcome": "OPENED. Two builds running have now turned on extracting a PDF and reading what it actually said. The one asset that cannot be extracted is the one carrying the founder's own instruction." }
]
```
