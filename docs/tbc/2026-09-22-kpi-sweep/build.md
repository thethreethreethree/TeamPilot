# BUILD — the sweep the ruling asked for

### The gamification board stops ranking for reps

- write-path: `/api/coach/gamification/leaderboard` now calls `requireSalesCoachManager` and
  returns a non-manager `{ period, managerView: false, meId }` — no rows, no `meRank`.
- write-path: **not a filtered board.** A board of one is a wrong board, and a rank is a rank
  however few people are on it.
- write-path: stripped at the ROUTE, consistent with the principle set when the ruling was applied
  to Pitch Score. A value that never leaves the server cannot be exposed by a rendering bug.
- read-path: `Scoreboard` renders an honest state — *"The team points board is for managers. Your
  own points and progress are on your dashboard, measured against your own past rather than against
  other reps."* Not an empty panel, which would read as "nobody on your team has scored".
- read-path: a manager's board is unchanged, and its tests pass with a manager mock added.

### One change, two surfaces

- write-path: **nothing was written for this.** `RepArena` is untouched by this build — the
  entry is here because the absence of a second edit is the result, and a build record that
  only lists files changed would not show it.
- read-path: `RepArena` renders `Best 106.5 · rank #2` from `lb?.meRank`. With the route no longer
  sending `meRank` to a rep, `?? null` makes the clause falsy and the rank disappears — **the
  Arena was fixed by the route change without being touched**.
- read-path: that is the §2.2 argument paying rather than being argued. Had the gate been written
  into `Scoreboard`, the Arena would still be printing a rank on the rep's own dashboard, and
  nothing would have pointed at it.

### The breakdown leads with a strength

- write-path: `strongestElement()` — the element hit closest to its ceiling, so a 2-point element
  hit every time beats a 9-point element hit half the time. The question is what the rep does WELL,
  not which element is worth most.
- write-path: an element never scored is excluded. Never attempted is a gap of its full value and
  would win whenever every attempted element was imperfect, telling a rep their strength is
  something they have never done.
- write-path: **honest about what this is not.** The KPI document says lead with what *improved*,
  which is a comparison against the rep's own past and needs a period-over-period read this board
  does not have. Leading with a strength is the growth-framing today's data supports; the gap is
  recorded rather than papered over.
- read-path: "Your strongest" sits ABOVE "Biggest opportunity". The same two facts in the other
  order are a different message to the person reading them, so the ORDER is what the tests pin.
- read-path: the opportunity is not removed. Growth areas follow the strength; they do not vanish.
