# REMEDIATE

### F1 — the gamification board served a full ranked list to every rep

fix: the route calls `requireSalesCoachManager` and returns no rows and no rank to a non-manager;
  the component renders an honest withheld state pointing the rep at their own dashboard.
gate-or-promise: gate. Four mutations fail, including the tempting middle — a board filtered to the
  rep's own row, which is still a board. The route's docblock carries the ruling so the next person
  to touch the handler reads it there rather than in a document.
residual: the nav entry for `/scoreboard` is still not `managerOnly`. That is deliberate: a rep
  reaching that page now sees their Pitch Score standing, which they are allowed, plus an honest
  explanation where the ranked list was. Hiding the page would also hide the part they may see.

### F2 — the Arena printed a rank on the rep's own dashboard

fix: none required. The route gate corrected it.
gate-or-promise: gate, inherited. The same four mutations cover it, because the Arena's rank comes
  from the field they withhold. What is NOT gated is the general habit — nothing asserts that no
  other component derives a ranking from some other endpoint. The sweep command is in check.md.

### F3 — the breakdown led with a deficit

fix: `strongestElement()` and a callout above the opportunity, with five mutations including both
  wrong ways to pick a strength.
gate-or-promise: promise, and it is a partial fix rather than a complete one. The KPI document asks
  the board to lead with what IMPROVED — a comparison against the rep's own past. This board reads
  one period and has no baseline, so what ships is *what you are best at* rather than *what got
  better*.

  That difference is not cosmetic. "Your strongest is Tone" is a fact about a rep; "Tone improved 4
  points this month" is a fact about their growth, and the document is explicitly about the second.
  The clause is approximated, the approximation is labelled in the code, and the real
  implementation needs a period-over-period read that does not exist.
residual: `readPitchPeriod` can already fetch an arbitrary window, so a previous-period aggregate is
  buildable. It is a feature, not a fix, and it was not built here.

### F4 — two more fixtures that could not fail

fix: unit tests on the exported pure function, handed the cases that separate the implementations —
  a 2-point element hit every time against a 9-point element hit half the time, and an element
  never scored.
gate-or-promise: gate for these two; declined for the class, for the sixth time. The standing
  question is recorded and the only thing that finds them is mutation testing run by hand.
residual: the rate is now seven across seven builds. Every one was found by mutation and none by
  review, which is the strongest argument available that reading a test does not verify it.
