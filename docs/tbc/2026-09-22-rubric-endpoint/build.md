# BUILD — the rubric has three consumers and no door

### Serve the rubric to a client that cannot import it
- write-path: `src/app/api/coach/sales-session/pitch-score/rubric/route.ts` — one GET returning
  `version`, `baseMax`, `bonusCap`, `maxScore`, `gradeCredit`, `sections`, `elements`, `bonuses`,
  `violations`, read straight off `rubric.ts`. Nothing is reshaped, rounded or renamed.
- write-path: no database client is created. There is no user data here and nothing for RLS to
  scope, so the route takes no `repId` and performs no read. Authentication is still required —
  this is the company's scoring methodology, not public documentation.
- read-path: the mobile Breakdown board gets section maxima for its "9.8 / 12" bars and for the
  percentage-of-max LOWEST rule; the mobile rubric sheet renders every number from the server, which
  is what the guide means by "so it never goes stale".

### Let a client hold it, because a doorstep is not a desk
- write-path: `Cache-Control: private, max-age=3600`. The body changes only when the rubric version
  changes, and a phone should not refetch thirty elements to open a sheet twice.
- read-path: short enough that a rubric correction reaches a phone the same day rather than on the
  next install.
