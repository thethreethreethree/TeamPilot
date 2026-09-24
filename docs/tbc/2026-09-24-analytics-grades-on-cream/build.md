# BUILD — the weakest skill was the least readable thing on the screen

### Grade colours, mode-aware, dark preserved

- **write-path:** `text-emerald-600 dark:text-emerald-300` and
  `text-amber-600 dark:text-amber-300` in the grade ternary at `analytics/page.tsx:576-583`.
- **read-path:** `npm run visual -- salesCoachAnalytics`, light capture — "D 4.4/10" renders in a
  strong orange instead of pale yellow; dark is unchanged.

```
$ npm run visual -- salesCoachAnalytics
      Tests  2 passed (2)
  4 image(s) in artifacts/visual/
exit 0
```

The middle band, `text-brand`, is untouched and was always correct — it resolves through
`--brand-text`, which is ember.400 on dark and ember.700 on light. The two branches either side of
it used raw `-300` tints.

**The number that mattered most was the one worst affected.** This page's own copy promises "one
score per skill, so you know exactly what to work on next"; the score below 5 is that answer, and
it rendered at roughly 1.5:1 on cream. The band for a rep's best skill had the same problem. The
mediocre middle rendered perfectly.

### Skill cards that had no borders on cream

- **write-path:** `border-default` and `bg-surface` replacing `border-white/[0.07]` and
  `bg-white/[0.02]`, four instances in `analytics/page.tsx`.
- **read-path:** the same captures — light went from floating rows to bordered white cards, dark
  unchanged.

Same class as the Sales Coach home this morning. Neither capture alone shows it; the pair does.

### A fixture whose one bad number produced three symptoms

- **write-path:** scores of 7.2 / 5.8 / 4.4 in
  `src/test/captures/salesCoachAnalytics.capture.tsx`, with a comment recording what happened.
- **read-path:** the rendered grades — B, C, D — instead of "A+" on every row.

The first fixture used 72 / 58 / 44. The page rendered "A+ 72/10" three times, under a header
saying "last 0 scored calls" while each card said "14 of 18". Three defects, apparently
independent.

The scale is 0-10 and `RepSkillGrades.tsx:21` says so in words. 72 saturates the grade; the header
reads `sampleSessions`, which the fixture never supplied.

Also fixed in that file: a matcher waiting on `/66|session/i`, which matched the word "session"
**inside the empty-state sentence** — so it was green while the page rendered nothing, and went red
the moment the page populated. It now waits on a skill label. A matcher that only matches the empty
state is the vacuous-green shape wearing a capture's clothes.
