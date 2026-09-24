# REMEDIATE

### A class name that matched no rule

gate-or-promise: gate — and the gate is the config change itself

`stroke-primary` and `fill-primary` now exist, so the intent a developer writes is the intent
Tailwind compiles. That is the producer fixed, not the instance: the next person to reach for a
theme token on an SVG gets it, instead of getting silence.

**Why a lint rule is NOT the gate here.** The obvious reflex is "check that every class name
resolves". That check is real but it is enormous — it needs Tailwind's own resolver over every
`className` expression in the codebase, including every template literal and every ternary. The
config change costs six lines and removes the whole reason the mistake was available.

**The promise that survives it:** a Tailwind class naming a design token is only valid for the
PROPERTIES the config extended. `text-primary` existing does not mean `stroke-primary`,
`fill-primary`, `border-primary` or `ring-primary` exist. This failure is silent by construction
— nothing throws, nothing warns, and the class name is still in the DOM afterwards, which makes it
look applied in devtools.

**And the tell for finding the rest of this family by eye:** an element styled entirely by a token
class that renders in the *browser's* default (black fill, no stroke, `1px solid` borders) rather
than in the theme's. Black where the theme has no black is the signature.

### A `<circle>` inside `preserveAspectRatio="none"`

gate-or-promise: promise

One instance in the codebase; a gate for one instance is overhead.

**The promise:** inside `preserveAspectRatio="none"`, x and y scale by different factors, so every
shape that must stay round — a dot, a corner radius, an end cap — needs
`vectorEffect="non-scaling-stroke"` and a stroke, not a fill. The author already knew this: the
`<path>` one line above carried the guard. **A guard applied to one element and not its sibling is
the same shape as a gate honoured in one branch and not the other**, which is §2.2 at the level of
a single JSX block.

### One band chip of five

gate-or-promise: promise

Fourth occurrence today of the same shape, and at this point the repetition is the finding rather
than the instance:

- the Analytics grade ternary — `text-brand` in the middle branch, raw `-300` either side;
- `PitchBreakdown` — `skippedPreVerdict ?? 0` and `capped === true` guarded, `aggregate` not;
- `TodaysMetrics` — `data?.scores?.[d]` two lines above `data?.kpi.doorsKnocked`;
- and here, four contrast-aware bands and one that is not.

**The tell, sharpened by the repetition: when a literal contains several members of one decision,
they are each other's evidence.** If three entries in a map are mode-split and one is not, the odd
one is a defect, not a choice. That is cheap to notice at the moment of writing and it would have
caught all four.
