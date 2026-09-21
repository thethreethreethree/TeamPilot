# BUILD — the founder ruled, and two of my calls were wrong

### What a rep receives

- write-path: `/pitch-score/leaderboard` no longer sends a rep their `rank` or the board size, and
  sends `gaps.ahead: null`.
- write-path: **stripped at the route, not hidden in the component.** A value that never leaves the
  server cannot be exposed by a rendering bug, and the component is the layer most likely to be
  refactored by someone who has not read the reasoning.
- write-path: what a rep still gets is their own totals and ONE distance — how far behind the rep
  immediately above. The ruling's line is sharper than the one I had drawn: **is this a target or a
  position?** A distance you can close is a goal and survives; a rank and a cushion you can lose are
  positions and do not.
- read-path: the standing card leads with the rep's own total instead of an ordinal, and the
  heading changes from "Where you stand" to "Your pitches".
- read-path: the component branches on whether `rank` is PRESENT, never on `managerView`. A wrong
  flag cannot produce a rank out of nothing, because there is nothing to render.
- read-path: a manager is unchanged. Cross-agent ranking is manager-only, which is what the KPI
  document says rather than a restriction invented here.

### The copy that had to change with it

- write-path: the no-standing state said *"You are not on the board for this period — that is not
  last place."* It had to deny a ranking in order to explain itself, and a rep is no longer shown
  one. It now reads *"No pitch of yours has counted this period. A pitch counts once it reaches 40
  base points."*
- read-path: the replacement says the same useful thing — you have not lost, nothing has counted —
  without introducing the concept it was reassuring the rep about.

### The record

- write-path: `LOGIC-AND-CONTRADICTIONS.md` section L gains a **resolved** entry: the ruling, the
  three calls it overturned or upheld, where it is enforced, and the lesson.
- write-path: the route's docblock carries the same ruling, because the next person to touch that
  handler will read the file and not the document.
- read-path: a reader who opens `LOGIC-AND-CONTRADICTIONS.md` finds section L followed by
  "L (resolved)" — the concession I made and the ruling that overturned it, both standing. Section L
  is not edited (§3.1); the resolution is appended beneath it.
- read-path: a developer who opens the route finds the same ruling in the handler's docblock,
  because the next person to change that code will read the file and not the document. The two say
  the same thing deliberately, and the document is named in the code as the source.
