# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json
(no output)
exit 0
```

```
$ npm run visual -- salesCoachAnalytics
      Tests  2 passed (2)
  4 image(s) in artifacts/visual/
exit 0
```

## It was looked at — four captures plus a cropped strip

**Light, before** — "Your skills" over three rows with **no card boundaries**: DISCOVERY, OBJECTIONS
and CLOSE as floating text with their scores at right, "D 4.4/10" in a pale yellow noticeably
brighter and weaker than the bronze B and C beside it.

**Dark, same moment** — the same content as three clearly **bordered** cards, scores in amber.

**Light, after** — three white bordered cards; "B 7.2/10" and "C 5.8/10" in bronze and
"D 4.4/10" in a strong orange, all three legible.

**Dark, after** — unchanged from before.

The comparison is the method. Neither capture alone shows the missing borders, and neither alone
shows that one grade band is weaker than its neighbours.

## Findings

### Two of three grade colours are dark-mode tints; the middle one is correct

class: a raw palette tint used where a contrast-aware token exists, in the same expression as a correct use of that token
sweep: `sed -n '576,583p' src/app/dashboard/sales-coach/analytics/page.tsx` — the whole scale is one ternary
severity: high

**[OBSERVED]** `>= 8` → `text-emerald-300`, `>= 5` → `text-brand`, `< 5` → `text-amber-300`.

**[OBSERVED]** `text-brand` resolves through `--brand-text` (ember.400 dark / ember.700 light) and
is right. The `-300` values are near 1.5:1 on cream.

**[OBSERVED]** in the light capture, the sub-5 score is visibly weaker than the two bronze ones.

High because of which number it is: the page promises "one score per skill, so you know exactly
what to work on next", and the sub-5 score IS that answer. The band for a rep's best skill has the
same defect. Only the mediocre middle renders correctly.

### Skill cards lose their borders on cream

class: white-at-low-opacity used as a border or fill on a surface whose ground follows the theme
sweep: `grep -oE "(border|bg|text)-white/(\[[0-9.]+\]|[0-9]+)" src/app/dashboard/sales-coach/analytics/page.tsx | sort | uniq -c`
severity: medium

**[OBSERVED]** four `border-white/[0.07]` and four `bg-white/[0.02]` in this file; all eight
replaced.

**[OBSERVED]** same class fixed on the Sales Coach home earlier today. This is a second surface,
found by rendering rather than by the grep — the 256-site count from this morning remains a
suspect list, and this is one member confirmed out of it.

### A fixture whose single bad number produced three symptoms

class: a fixture value outside the range its consumer assumes
sweep: not a codebase sweep — the fifth instance of my own error today
severity: medium

**[OBSERVED]** scores of 72 / 58 / 44 on a 0-10 scale rendered "A+ 72/10" three times, under a
header reading "last 0 scored calls" beside card text saying "14 of 18".

**[OBSERVED]** `RepSkillGrades.tsx:21` states the scale in words. The header reads
`sampleSessions`, which the fixture omitted.

The symptoms multiplied, which is what made it convincing: three independent-looking defects, each
with a plausible story, from one out-of-range number.

## What this does not prove

**The emerald band was never rendered.** No fixture score reached 8, so the `>= 8` branch is fixed
by reading rather than by seeing. Its sibling was observed and the values are the same family.

**Two surfaces remain unrendered:** Roleplay and One Liners.
