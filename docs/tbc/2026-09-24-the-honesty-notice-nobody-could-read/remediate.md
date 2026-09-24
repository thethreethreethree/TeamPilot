# REMEDIATE

### I characterised a class from its hex and the founder decided on that

gate-or-promise: promise, and the promise is about REPORTING rather than about code

When the founder chose the deck-kit scope this morning, the option they declined was described in
my own words as "ugly, not broken … the severity of this class is set by the ground, and these
grounds are cream." The severity claim was correct in form and wrong in fact: on cream these
controls read as DISABLED, which is an inverted affordance, not an aesthetic complaint.

**The promise: do not put a severity estimate into a decision the founder is making unless it came
from a render.** A picker option carrying an unrendered severity is a confident-well-formed-failure
aimed directly at the one person whose decision it changes — the §5 failure mode pointed at the
founder rather than at the code.

Four of the eleven are now fixed and rendered. Seven remain, and they are in the residual with the
corrected characterisation rather than the original one.

### `text-white/N` as body text

gate-or-promise: gate — and this one is now worth writing

Every earlier deferral of the `theme-audit` widening rested on "a gate cannot tell a fixed-dark
ground from a theme-following one, so it would flag correct code." That is still true for
`bg-` and `border-` values.

**It is much weaker for `text-`.** A `text-white/N` on a theme-following surface is invisible text —
the single worst outcome in this whole class — and the fixed-dark exceptions are few, named and
concentrated: `CareShell`, `SalesCoachShell`, and anything under `bg-brand-shell`. That is an
allowlist of three, not an open-ended judgement.

**The proposal, sharpened from "widen the property list" into something writable today:** flag
`text-white/N` outside the known fixed-dark shells. 75 uses, 5 files, and the two files that
mattered were the two that were not shells.

### A gauge track and a standard tick that exist only as colour

gate-or-promise: promise

Fourth spelling of the class, and the tell from the previous build held exactly: **an element that
exists only as colour does not degrade when its colour fails — it disappears, and nothing in the
DOM is missing.**

Today's four spellings: `bg-`/`border-` on a card, `stroke-white/N` on a dial tick, a positioned
`<span>` with `bg-white/12` as a hairline, and `text-white/N` driving `currentColor` on an SVG
stroke. A sweep that matches property names will keep missing the fourth kind, because its property
name is `text`.

### Capturing one branch and calling it the file

gate-or-promise: gate — the same gate as the previous build, applied twice more

`sessionsList` shoots three branches; `salesCoachAnalytics` gained an Expert variant.

Third and fourth occurrence in ninety minutes. Standard is the default and therefore the right
primary choice, which is exactly why it is the trap: the Expert branch is where the timeline, the
session-start form and the ELO gauge live, and none of them had ever been photographed.

**The promise: before capturing a page, grep it for its mode gates** — `isStandard`, `isExpert`,
`isManager`, `isOwner`. Each one is another screen, and a capture of one branch is not a capture of
the file.
