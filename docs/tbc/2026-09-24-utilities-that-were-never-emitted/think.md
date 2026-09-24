# THINK — the class behind `stroke-primary`

started_at: 2026-09-24T10:10:00Z

## Where this came from

The previous build fixed `stroke-primary`, which was not a utility at all: `primary` is registered
on `textColor` and nowhere else, so Tailwind emitted no rule, the class name survived into the DOM
looking applied, and `MyProgress`'s trend line was never drawn in either theme.

Its residual (R2) said the obvious thing: **`text-primary` existing does not mean `border-primary`,
`ring-primary` or `bg-primary` exist, and only `stroke-`/`fill-` had been swept.** This build is
that sweep.

## What the codebase already knew

`src/__tests__/no-invisible-bare-color-utilities.test.ts` guards a NEIGHBOURING class — a colour in
`theme.extend.colors` that is a scale object with no `DEFAULT`, so `bg-brand` emits nothing (the
2026-07-22 invisible-download-button incident). Its comment draws the line explicitly:

> "names defined solely in textColor/borderColor (secondary, muted, primary, accent-text, default)
> are a different **'wrong-namespace' concern, out of scope for THIS guard**."

So the class was **named, documented and left open**. Not missed — declared out of scope and never
picked up. That is a better starting position than a blank page and a worse one than a gate,
because the note reads like coverage to anyone skimming.

And the reason the class exists at all is a CORRECT decision: `tailwindColorCollision.test.ts`
records V7, where a colour named `base` on top-level `colors` collided with the `text-base`
FONT-SIZE utility and turned every `text-base` element's text the colour of the page background.
The fix was to register semantic tokens on per-property scales. The cost of that fix is that a
token is only valid for the properties it was registered on — and nothing enforces that.

## Measuring it

My first pass was a hand-written regex and it reported 126 hits, most of them `text-base` — which
is a real Tailwind font-size, not a colour. My second pass, a probe built on Tailwind's own
`resolveConfig`, reported **zero**, which was a bug in the probe.

Neither number was true. A checker I had just written returning a clean zero is the "suspicious
empty flag list" §1.7 warns about, so I stopped and verified the instrument directly:
`resolved.backgroundColor.primary === undefined`, and `bg-primary` appears in four files. Then I
enumerated from that footing.

**56 uses across 21 files.** The founder chose the `bg-` subset — 26 uses in 15 files — and a gate
scoped to it.
