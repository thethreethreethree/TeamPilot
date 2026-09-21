# BUILD — six badges, read off the sheet rather than off their names

### The six milestones, defined from the PDF

- write-path: `src/lib/coach/pitchScore/milestones.ts` — `derivePitchMilestones` returns an
  earned-at date per badge, or null. Pure, so it is tested without a database.
- write-path: **the definitions were extracted from the sheet, not inferred from the badge names**,
  and two of them prove why that mattered. The rep dashboard PDF is in the tree; its text reads:

  ```
  Full bundle     DTV + Wireless + ADT in one pitch
  Clean sweep     Every phase fully hit
  Century         100 scored pitches
  ```

  **Clean sweep is "every phase fully hit" — not "no violations"**, which is the obvious reading
  and wrong. **Full bundle names three specific products** — not "any three bonuses". A build that
  inferred either from the name would have shipped a badge that fires on the wrong pitches and
  looks entirely plausible doing it.
- write-path: `tripleDigits` and `inTheDoor` carry no caption on the sheet and ARE inferred — 100+
  on a scale that reaches 130, and the rubric's own `bonus.inside`. Both are marked as inferred in
  the module, so the next reader can tell which definitions came from the sheet.
- write-path: "fully hit" is read strictly — a Partial is not a hit. A badge that accepted partials
  would sit above a section the breakdown screen shows in amber.
- write-path: counted pitches only, everywhere. A pitch that never reached Discovery must not earn
  a rep "First pitch".
- read-path: every key is present with a null when unearned, so the strip renders six badges rather
  than a ragged row.

### A second milestone set, standing beside the first

- write-path: `gamification/milestones.ts` — `spark` was **"First pitch scored"** and is now
  **"First session scored"**. Only the label changed; the derivation is untouched, so no earned-at
  date moved — which matters, because those dates are derived from the immutable ledger precisely
  so they cannot.
- write-path: the two sets are not merged, and the reason is arithmetic rather than taste. The
  Arena's badges count SESSIONS on the points ledger; these count COUNTED PITCHES. A rep records
  sessions that never qualify, so the two diverge permanently and the same rep reaches them on
  different days. Merging would mean picking one denominator and silently moving dates the Arena
  has already shown a rep.
- read-path: `/dashboard/sales-coach/my-progress` now carries both strips, each saying what it
  counts — the same resolution the scoreboard page uses for its two leaderboards. This closes the
  collision the two-systems map recorded: *"Built fresh, a rep earns two First-pitch badges and two
  Centuries under different names."*

### An all-time, oldest-first read

- write-path: `src/app/api/coach/sales-session/pitch-score/milestones/route.ts` — **no period**,
  which is the whole difference from the breakdown route beside it. Every milestone is a "first" or
  an "Nth", so a window answers a different question and answers it confidently: *"your first pitch
  was Monday"* is true of this week and false about the rep.
- write-path: `readPitchPeriod` gained `oldestFirst`. The read caps at 900 because PostgREST tops
  out at 1000; on a newest-first read a rep past that cap would have "First pitch" dated to their
  900th-most-recent pitch. Ascending means the cap costs a rep their most RECENT pitches, which no
  milestone depends on.
- write-path: caller-scoped, so RLS decides. 0252 grants select to the rep themself or a Sales
  Coach manager — exactly this route's rule, so there is no service-role read and no need for one.
- write-path: the response carries `capped`. The milestones are still correct when the bound bites,
  but a silent cap is the defect the leaderboard's own residual names, and a later "latest" badge
  would need to know.
- read-path: `GET …?repId=…`, defaulting to the caller. Without that default a manager's request
  would derive one person's milestones from the whole company's pitches.

### The strip

- write-path: `src/components/sales-coach/PitchMilestones.tsx` — six badges always, unearned ones
  greyed with their caption rather than hidden. A strip that showed only what a rep had earned
  would be empty on their first day and would never tell them what there is to reach: the
  difference between a trophy case and a map.
- write-path: the state is in the WORDS as well as the styling — "Not yet" is the only thing
  separating an unearned badge from an earned one for a reader who cannot see the border, and the
  only thing a screen reader gets.
- write-path: the date is short-month, no year, in the READER's order. The sheet draws "12 Aug" and
  a US reader gets "Aug 12"; day-month order is a convention belonging to whoever is reading, not a
  design decision the sheet was making. What the sheet does specify — short month, no year — is
  honoured.
- read-path: loading, failed and ready are three distinct states. Six grey badges is a statement
  about the rep, and a failed read must not make it.
