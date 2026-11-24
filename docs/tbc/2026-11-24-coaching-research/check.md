# CHECK - Coaching wording grounded in research

## Commands

```
research: six sources' primary texts read; every quote verbatim (docs/rss/COACHING-WORDING-RESEARCH.md)
npx vitest run salesReviewPrompt.researchRules.test.ts → first: 1 failed (my own test matched "ratio" inside "preparation") → word boundary → 2 passed
npx vitest run src/lib/coach/v5 MacroCallView.render → 778 passed
```

## Findings

### F1 - the PDF's "Harvard research" can't be verified as research
class: a requirement naming a source that doesn't exist in the form assumed.
sweep: Harvard-affiliated pieces found are opinion (HBR 2019) and practitioner guidance (HGSE 2017); recorded, not cited as research.
severity: medium (a public claim)

## Final

```
npm run check → first: ✗ tbc:manifest (§4 and §1.5.4 cited without manifest entries — read and added) → ✗ americanSpelling ("BEHAVIOUR" in the prompt) → "BEHAVIOR" → exit 0 · Test Files 909 passed | 1 skipped · Tests 6695 passed | 15 skipped
```
