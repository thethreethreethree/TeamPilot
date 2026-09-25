# REMEDIATE

### I swept a route's tree, then fixed only two of its files

gate-or-promise: promise, and it is the most embarrassing one of the session

The render-tree sweep named `LiveCoachingPanel`'s two sites an hour before this build. When I
"fixed `/[id]`", I patched `[id]/page.tsx` and `PivotAndScores` — the two files I had rendered —
and left the third, then wrote a closure saying both files reported zero.

Both files did. The ROUTE did not.

**The promise: the unit of a FIX is the same unit as the sweep.** Having established that the tree
is what gets measured, measuring the tree and then fixing the files is the original per-file error
wearing the new vocabulary. A route is done when its tree is zero, not when the files I happened to
open are.

### Atomic units need somewhere to wrap to

gate-or-promise: promise

`whitespace-nowrap` on the chips was right and, alone, made things worse — the row could no longer
wrap, so content left the card entirely.

**The promise: `whitespace-nowrap` on children requires `flex-wrap` on the parent.** One without
the other converts a cosmetic line break into lost content, and lost content does not announce
itself — nothing in the DOM is missing, the pixels are simply outside the box.

**And the method point:** I would not have caught step 2 without re-rendering after step 1. The
temptation after a correct-feeling fix is to move on; three passes here produced one correct
result, and passes two and three cost about ninety seconds each.

### A matcher satisfied by text that is always present

gate-or-promise: promise — eighth instance, so the wording gets sharper

Previously: "a wait condition satisfied by the state you are not trying to capture." That has not
been enough, because I keep writing them.

**The sharper form: the wait token must be a string that EXISTS ONLY in the state being
photographed.** `/audio|mic|recording/i` matched "MIC LEVEL", which is chrome. `/nothing is being
captured/i` is the banner's own sentence and appears nowhere else.

The test for a matcher is not "does it pass" — it is **"would it fail if the feature were absent?"**
Mine would not have.

### Judging a layout at a width the product does not use

gate-or-promise: promise, and it worked

The first shot was 430px, chosen because it is a phone width. The panel lives in `max-w-md` — 448.
Re-shot before judging.

**The promise: the capture's width is read from the container, never chosen.** `grep max-w-` on the
page is the whole procedure. Here the wrap survived the correction and was real, but the check cost
nothing and its absence is what produced this harness's first false finding.

### The control row

gate-or-promise: declined — surfaced to the founder

Six controls in a 448px column, each label on three lines. Nothing clipped, everything readable.

Not changed, because re-laying out the live-call control row is a design decision inside a colour
pass, and §2's "surface, don't overtake" applies most where the change would be easiest to justify
afterwards.
