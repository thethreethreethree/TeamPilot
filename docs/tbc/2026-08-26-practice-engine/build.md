# BUILD — Practice engine (slice 3 of the training system)

### the focus seed (prospect behaviour)
- write-path: `roleplay/route.ts` — `Body` gains an optional first-class `focus` (≤600). `prospectSystem` appends a
  `focusLine` when present: the prospect naturally creates moments that test the skill while staying in character.
  The `turn` phase already calls `prospectSystem(body,...)`, so it inherits the seed with no other change.
- read-path: the rep drills against a prospect that actually surfaces the situation their skill targets.

### the focus-anchored scored review
- write-path: `roleplay/route.ts` — `practiceReviewSystem` (scores the ONE drilled skill, not a generic grade) +
  `parsePracticeReview(text, focus)` (reuses `parseReview` for the qualitative half → single-source honesty, then
  layers `{applied, score(0-100 clamped), nextRep}`; null on malformed → 502). The `review` phase branches: `focus`
  present → scored `{review, scorecard}`; absent → the original `{review}`, byte-for-byte unchanged.
- read-path: at End & review the rep gets a score on the skill, or an honest applied:false when they never reached it.

### the roleplay page (seed in, scorecard out)
- write-path: `roleplay/page.tsx` — reads `?focus=` once on mount (URLSearchParams, no Suspense dep), stores
  `practiceFocus` (threaded into sessionStorage recovery + every `post`), captures `scorecard` from the review, renders
  a "You're practicing" banner (setup) + a scorecard card (review: score / honest applied:false / next-attempt line).
- read-path: launching from a focus is a seamless pre-seeded, scored practice; a plain roleplay is unchanged.

### the entry point (Training tab)
- write-path: `training/page.tsx` — `FocusItem` makes each of the rep's OWN focuses a "Practice" link to
  `/roleplay?focus=<encoded skill>`; `TrainingList` gains `practiceable` (rep view only; manager per-rep read stays a
  plain list — a leaderboard-free surface, §A18).
- read-path: rep opens Training → hits Practice on a weakness → drills it → scored → repeats.

## Files
- `src/app/api/coach/sales-session/roleplay/route.ts` — focus seed + scored review + parsePracticeReview.
- `src/app/dashboard/sales-coach/roleplay/page.tsx` — focus seed in, scorecard out.
- `src/app/dashboard/sales-coach/training/page.tsx` — per-focus "Practice" links (rep view).
- `src/app/api/coach/sales-session/roleplay/__tests__/parsePracticeReview.test.ts` — scorecard honesty tests.

## §3.4 / §A18
- §3.4: applied:false is a valid honest outcome; parsePracticeReview null on malformed (route 502s); score clamped
  0-100, never inflated; a rep with no focus yet simply has no Practice links (honest empty).
- §A18: the score is the rep's own attempt against their own skill — self-data for self-improvement, NOT surfaced to a
  manager as a cross-rep ranking. Manager per-rep view stays a plain (unscored, unpracticeable) read.

## Ripple (holistic — §6 item 5)
- The default (no-focus) roleplay path is untouched — a single `if (body.focus)` branch. No schema, no persistence, no
  new route (reuses the existing one). dissectCoachV5 + corpus grounding reused as-is.
- Slice boundary: manager-visible practice ANALYTICS (who practiced, trend) needs a schema and is a follow-up, not here.

## Honest limit
Practice is stateless (mirrors roleplay's design) — the scorecard shows once, is not stored, so there's no practice
history or manager rollup yet. The seed is the raw focus text (a real coached skill); a richer scenario generated from
the focus + the team drill is a natural enhancement.
