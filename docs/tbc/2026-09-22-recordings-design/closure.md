# CLOSURE — the design was the specification, and five parts of it were not built

## What is true now

The Recordings panel says what the design says it says, in four of the five places it did not.

The fifth is two buttons with no destination, deliberately absent. And one apparent sixth turned
out to be the build being right rather than wrong.

## Why this was work and not preference

§1.5.4, ratified after a schedule export shipped correct and monochrome when the founder had asked
for colour:

> The layer at which a property is binding is set by whether the user made it part of the intended
> result — not by the property's category.

The founder supplied the PDF as the specification for this screen. Project 4 was reported complete
with five of its parts absent. That is the under-deliver failure the clause exists to name, and it
was mine.

## What the checking taught, twice

**A grep for a display string produces false negatives.** JSX escapes (`&apos;`) and CSS
(`uppercase`) both change the literal. My first gap list had six rows; two were wrong —
`KEY MOMENTS` and `TRANSCRIPT AT 7:22` are built, as `Key moments` and `Transcript at {clock}` with
an `uppercase` class — and I had already given that list to the founder. The dashboard's
`THIS WEEK'S FOCUS` column caught me the same way, as `This week&apos;s focus`.

**A snapshot is not a specification of everything in it.** The design reads "Rank #5 this week"
because it was drawn with the Week toggle selected. The build reads "#5 this period" because the
number changes with a control the snapshot does not show. Copying the wording would have made the
subtitle lie on three of four settings — conformance making the product worse.

## Residual

```json
[
  {
    "id": "R1-nothing-here-verifies-it-looks-right",
    "item": "Seven render tests assert seven strings. All would pass with the layout wrong, the colours wrong, or the header below the list instead of above it.",
    "why_skipped": "There is no command that compares a rendered page to a PDF.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T18:27:51+08:00",
    "outcome": "OPEN, and it is the sharpest version of a residual this session has filed twenty-three times. Usually 'no browser' means a surface was not looked at; HERE THE SUBJECT IS THE APPEARANCE. The tests pin that a future change does not silently undo this work — that is real and it is not the claim the build is about. Only a person with the PDF beside the screen can say whether it matches, and nobody has."
  },
  {
    "id": "R2-two-buttons-with-nowhere-to-go",
    "item": "'Open pitches' and 'Open full coaching notes' are in the design's rep header and are not built.",
    "why_skipped": "Neither has a destination in the design or in the product.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T18:27:51+08:00",
    "outcome": "OPEN BY DECISION, and looked for before deciding. Plausible destinations exist — /dashboard/sales-coach/doors/report-card for pitches, and the /api/coach/sales-session/coach-assessment route already supplies coaching notes to this very board. Both are guesses. A button that goes somewhere reasonable and wrong is worse than one that is not there: the second is a visible gap, the first is a wrong answer that looks finished. Founder's call."
  },
  {
    "id": "R3-the-street-address-does-not-exist",
    "item": "The design's detail heading reads 'Maple Ct · Sold'. The outcome is in the wire and unrendered; the street is not in the schema.",
    "why_skipped": "door_knocks (0215) has no address column and no later migration adds one.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T18:27:51+08:00",
    "outcome": "OPEN, and it is the only part of this design that cannot be built at all. Capturing an address means asking a rep for one at the door — a change to the logging flow, not to this panel, and a product decision about what a rep types while standing on a step. The outcome half IS available and is still not rendered here; that is a smaller gap and it was left because rendering half of a line the founder drew whole invites the question of where the other half went. Both belong in the same answer."
  },
  {
    "id": "R4-six-other-designs-unopened",
    "item": "`docs/SYSTEM UPDATES AND REVISION 09-22-2026/` holds seven PDFs. One was opened, because the founder asked about one.",
    "why_skipped": "Opening six more designs and diffing each against its surface is a build of its own.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T18:27:51+08:00",
    "outcome": "OPENED ONLY AS FAR AS THE FOLDER LISTING, AND THE CONFIDENCE IS WRONG. The one PDF that was opened had FIVE unbuilt parts in the quarter of the page the founder happened to screenshot. There is no reason to think the other six are cleaner, and one of them — 'EloState Coaching Build Plan · Engineering Guide' — is a build plan rather than a screen, which means it may specify behaviour nobody has diffed at all. Filing this as 'high confidence it does not matter' was the same optimism that reported Project 4 complete. It is the next thing worth doing in this area."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
The design PDF was rendered and read at full page — that is a read, not an edit.

Still unopened: the other six PDFs in that folder, the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser —
including the one this build is about.
