# CORRECTION — the closure claimed a completeness it had not measured

Appended 2026-09-24T09:30Z. The closure file is left as written; this stands beside it.

## What the closure said

> "Thirteen of thirteen."
> "No Sales Coach screen remains unrendered."

## What is true

`find src/app/dashboard/sales-coach -name "page.tsx"` returns **23 routes**. Thirteen were
rendered. Ten were not:

`/[id]/after-pitch` (1815 lines, 10 own `white/N`), `/settings` (1060, 9), `/sessions` (1011, 8),
`/[id]` (1159, 5), `/kpi` (909, 5), `/training` (379, 6), `/team` (376, 3), `/scoreboard` (40, 0 —
but its chart's axis lines are `stroke-white/10`), `/calibration`, `/team-chat`, `/door`.

48 white-alpha sites live in unrendered page files.

## How it happened

I enumerated thirteen surfaces this morning and carried that list forward all day as though it were
the module. Every count after that was taken against the list. Thirteen of thirteen was arithmetic
on my own denominator.

## Why this one is worth more than the fixes it sits next to

Every phantom today was the same error in one direction: **evidence that looked real, supporting a
finding that was not.** Eight of them, and the discipline that caught each one was "read the
producer, not the render."

This is the other direction, and it is harder to see. **The evidence was real** — thirteen screens
were genuinely rendered, in both themes, one image at a time, and every defect reported from them
was genuine. The conclusion drawn from that real evidence was still false, because the
DENOMINATOR was assumed instead of measured.

No gate could have caught it. The tests measured the captures, the captures measured the list, and
the list measured nothing. The only thing that catches it is asking what the set actually is before
reporting a fraction of it — which is one command, and I ran it forty minutes too late, after the
claim had been committed twice and written into a founder-facing brief before an investor demo.

The closure's own last line, "No Sales Coach screen remains unrendered", is the §5
confident-well-formed-failure exactly as the constitution describes it: fluent, internally
consistent, supported by real work, and wrong.

## What follows from it

- `docs/DEMO-READINESS-2026-09-24.md` section 9 carries this correction to the founder, with the
  table and the specific demo consequence: the After Pitch Summary is the natural end of the
  manager demo path and is the least-known screen in the module.
- Section 3's `white/N` figure is corrected too — "~253 across 47 files" is really **508 across 97
  files**, roughly double, in the direction that made an unexamined risk look smaller.
- The residual item R5 in this closure ("a capture proves how a shape RENDERS, never that the shape
  ARRIVES") stands. This adds a second one: **a pass proves what it covered, never what it did not
  enumerate.**
