# THINK — paying off a "fixed by pattern" debt

started_at: 2026-09-24T10:36:00Z

## Why this route, and why now

Not because it was next by size. Because of a debt I named in the previous closure:

> "`/calibration` is now interesting for a reason it was not an hour ago: it mounts CalibrationTool,
> whose submit button was changed in this build and has never been photographed."

The previous build changed this screen's "Submit & compare" button from `bg-primary text-white` —
a background that emitted no CSS, so white text sat on the page background — to ember. That change
was made **from source, without ever seeing the screen.**

I have spent the whole session drawing a line between "fixed and seen" and "fixed by pattern", and
naming the second as the weaker claim. A residual that names a weaker claim and then moves on is
just a tidier version of not checking.

## What I expected

One thing: that the button now renders as a solid ember bar with dark text, like every other
primary button in the module. That is all this capture was for.

## The fixture decision

Two states, because the scoring form and the trust report are two different screens, and
`perDimension` is deliberately **mixed** — three dimensions agreeing with the model and two not.

A report where every row says the same thing photographs one styling branch and leaves the other
unseen. Same reason the Scoreboard fixture put one rep in each of the five bands: on a screen whose
job is to distinguish, a fixture that does not distinguish proves nothing.
