# REMEDIATE

### Two of three grade colours are dark-mode tints

gate-or-promise: promise

Fixed; not gated, for the third time today and for the same reason each time.

`theme-audit.mjs` has a `paleText` category built for precisely this family. Its boundary is
`-100/200`. Every value in this build is `-300`. Widening that regex is one line and it would flag
correct code on the fixed-dark surfaces this codebase has by design, until those are rendered — a
check that cries wolf gets routed around, which A30 names as worse than no check.

**The promise:** when a colour is chosen for TEXT on a theme-following surface, the token is picked
by reading what it resolves to in BOTH modes. And the specific tell from this instance: **if the
expression already contains a contrast-aware token in one branch, the other branches are suspects.**
That is a cheap thing to notice and it would have caught this one at the time it was written.

### White-at-low-opacity borders on a theme-following surface

gate-or-promise: promise

Second confirmed member of a class whose suspect list was measured this morning at 256 uses across
47 files. Eight fixed here; the count stands.

**The promise is unchanged from this morning:** on a theme-following surface a border is
`border-default` and a card is `bg-surface`. The gate is still deferred behind the render pass, and
the reason is stronger now than when it was written — two of eleven rendered surfaces had this, and
several of the largest unexamined files are intentionally fixed-dark where the same values are
correct. Only looking separates them.

### A fixture value outside the range its consumer assumes

gate-or-promise: declined

No gate. A fixture's realism is not a checkable property — the check would need to know each
consumer's expected range, which is the knowledge whose absence causes the error.

Recorded in the fixture, which is the most it can do for itself. And recorded here because the
shape is new: this phantom's symptoms MULTIPLIED. One out-of-range number produced a wrong
denominator, a saturated grade and two disagreeing counts — three defects with three plausible
stories.

**What actually separated it from a real finding** was the same move as the four before it: read
the producer, not the render. The scale was stated in words, one grep away.

### A matcher that only matched the empty state

gate-or-promise: gate

The capture now waits on a skill label rather than `/66|session/i`, which matched the word
"session" inside the EMPTY-state sentence.

That is a real gate and it proved itself immediately: the matcher was green while the page rendered
nothing, and went RED the moment the page populated. A wait condition satisfied by the state you
are not trying to capture is the vacuous-green shape wearing a capture's clothes — the fifth
variant of it I have written today.
