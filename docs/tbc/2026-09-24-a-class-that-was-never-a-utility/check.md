# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json  → exit 0
$ npm run visual -- scoreboard       → 1 passed, 2 images
$ npm run check                      → 5511 passed, CHECK_EXIT=0
```

## It was looked at

**`scoreboard.light`, before** — the Pitch Score board at the top renders correctly: "WHERE YOU
STAND · 1st of 3 · 891 points from 12 counted pitches · 287 pts ahead of the rep below", three
bordered rows. Below it the Activity Points board: rank 1 has a green "Elite" pill, rank 4 an amber
"Developing" pill, rank 5 a red "Needs coaching" pill — and ranks 2 and 3 show **the word "Solid"
as bare grey text with no pill at all**. In the "Your progress" card above the table, a single
**black horizontal lozenge** floats at the right with nothing else in the frame.

**`scoreboard.dark`, before** — the same table with a subtle grey pill around "Solid", so the light
one is missing something rather than styled differently. The progress card shows two faint
gridlines, **no data line**, and the same black lozenge, which on near-black is nearly invisible.

**`scoreboard.light`, after** — "Solid" carries a grey pill matching its four neighbours. The
progress card shows a near-black line running 61 → 88 → 74 between two faint grey gridlines, with a
round dot on the last point.

**`scoreboard.dark`, after** — the same line in white, the same round dot, gridlines unchanged.

## Findings

### A Tailwind class that is not a utility

class: a theme token used with a property the config never extended
sweep: `grep -rnoE "\b(stroke|fill)-(primary|secondary|muted|brand|default|strong)\b" src` across every path in `content` → **2 hits, both in `MyProgress.tsx`**
severity: high

**[OBSERVED]** `tailwind.config.ts` defines `primary` under `textColor` and nowhere else; `primary`
is not in Tailwind's default palette.

**[OBSERVED]** The trend line is absent from the light AND dark captures. The dot rendered black in
both, which is SVG's default fill, not any token.

**[OBSERVED]** Every other `stroke-*`/`fill-*` in the codebase names a real palette colour.

High because of the failure mode rather than the blast radius. **It type-checks, it lints, it reads
correctly, and it does nothing.** Nothing in the twelve-step gate can see a class name that matched
no rule — the class string is just text in a `className`.

### A dot stretched into a lozenge

class: a shape that assumes uniform scaling inside `preserveAspectRatio="none"`
sweep: `grep -rn 'preserveAspectRatio="none"' src` → this is the only one
severity: medium

**[OBSERVED]** `viewBox="0 0 100 32"` inside `w-full h-12` is roughly 9:1. The `<path>` carried
`vectorEffect="non-scaling-stroke"`; the `<circle>` did not.

The author knew about the trap — they applied the guard to the path. The shape one line below did
not get it.

### One band chip of five is not contrast-aware

class: a raw white-alpha fill among four correct mode-split siblings
sweep: `Scoreboard.tsx:60-66` — the whole map is seven lines
severity: medium

**[OBSERVED]** Four of five bands carry `-700 dark:-300`; `solid` carries `bg-white/10`.

**[INFERRED]** "Solid" is the middle band, so on a real team it is the most common row — the one
that renders differently from its neighbours is the modal one.

**Fourth occurrence today of "the correct pattern is one branch away in the same literal"**, after
the Analytics grade ternary, `PitchBreakdown`'s two guarded fields beside its unguarded one, and
`TodaysMetrics`'s `data?.scores?.[d]` two lines above `data?.kpi.`.

## What this does not prove

**The config change was verified by argument, not by re-shooting every capture.** The edit is
purely additive — it creates utilities that did not exist — so only files using the new utilities
can render differently, and the sweep above is exhaustive over Tailwind's own `content` globs.
That argument is only as good as the sweep; it is written out so it can be checked.

**Seven routes remain unrendered**: `/settings`, `/[id]`, `/kpi`, `/training`, `/team`,
`/calibration`, `/team-chat`, `/door`.
