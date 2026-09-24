# REMEDIATE

### White-at-low-alpha containers, hand-rolled beside an imported kit

gate-or-promise: promise

The deck kit was fixed at source an hour ago and 22 cards were corrected by that one change. These
seven were not, because they are the same recipe typed out by hand in a file that also imports
`DeckCard` (`:23`) and uses it elsewhere.

**The promise:** when a file imports a primitive AND hand-rolls the primitive's own recipe beside
it, the hand-rolled copies are the ones that will drift. Fixing the producer does not reach them,
and a grep for the producer's name does not find them.

That is worth saying precisely because the previous build's whole argument was "fix the producer,
not the instances" — and it is still right, and it is not sufficient. The producer fix reached 22
cards in six files and missed seven cards in a file that imports it.

### The timeline track and nodes

gate-or-promise: promise — with a sharper tell than "check the ground"

Third instance today of a class that every `white/N` sweep missed for the same reason: the value
was not on a `border` or a `bg` of a card. It was on a positioned `<span>` used as a hairline, on
an SVG `stroke`, and on a node fill.

**The tell to carry:** a decorative element that exists ONLY as colour — a track, a tick, an axis,
a divider, a dot — has no text, no border and no content to fall back on. When its colour fails it
does not degrade, it **disappears**, and nothing in the DOM is missing. Those are the values worth
checking first on a theme change, and they are the ones a sweep for `border|bg|text` cannot see.

### Thirteen raw tints

gate-or-promise: promise

Fifth file, same substitution, done by regex this time with a `(?<!dark:)` guard and verified by
re-grep to zero rather than by eye.

The gate for this class remains where the previous build left it: widen `theme-audit.mjs`'s
property list from `border|bg|text` to the full ten. That is now the standing proposal, and this
build is its third piece of evidence.

### Capturing one branch and calling it the file

gate-or-promise: gate

The capture mocks `useExperienceMode` through a mutable holder, so both branches are photographed.

A real gate, and it caught something immediately: had I captured Standard alone — the default
experience, the obvious choice — every timeline value in this file would have gone unseen, and I
would have reported the file rendered. **That is the same error as "thirteen of thirteen", one
level down: a real capture of a real screen, supporting a claim about a set it did not cover.**

Twice in one hour, in two different shapes. The common root is not carelessness about the work; it
is reporting coverage against a denominator that was assumed rather than enumerated.
