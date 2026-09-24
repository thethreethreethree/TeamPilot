# THINK — a chart whose line never existed

started_at: 2026-09-24T10:00:00Z

## The task

`/scoreboard`, from the residual. A 40-line page mounting two components, chosen next because two
of its parts were already confirmed members of today's class from source:

- `Scoreboard.tsx:60-66` maps five point bands to chip classes. **Four are already contrast-aware**
  — `text-emerald-700 dark:text-emerald-300`, `text-sky-700 dark:text-sky-300`,
  `text-amber-700 dark:text-amber-300`, `text-red-700 dark:text-red-300` — and the middle one is
  `solid: "bg-white/10 text-secondary"`.
- `MyProgress.tsx:30-31` draws its 0 and 100 gridlines with `stroke-white/10`.

The band map is the Analytics ternary again: **the correct pattern is one line away in the same
literal, written by the same hand at the same time.** That is now the fourth occurrence of that
exact shape today, and the reason I keep writing it down is that it is not carelessness — it is
what happens when a decision is applied to the members of a list one at a time.

## The fixture decision that mattered

`POINT_ROWS` uses averages of 91 / 78 / 64 / 47 / 26 to put **one row in each of the five bands**.

A fixture with two bands would have photographed the defect that is present and left three chips
unrendered, and the whole point of this capture was to compare the five chips against each other.
That is the same discipline as rendering both themes: the defect is visible only in the comparison.

## What the render found that no reading had predicted

The "Your progress" sparkline rendered as **a black lozenge and nothing else** — in BOTH themes.
No line. That is not a theme defect; it has never worked.
