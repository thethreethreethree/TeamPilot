# CLOSURE — complete the Coach v5.0 Knowledge Base to 10/10 books (D6)

## What shipped
The Coach v5.0 Knowledge Base is now **10 of 10 books**. The final 3 — Carnegie, Gladwell, Stone/Patton/Heen —
were compiled by a founder-opted-in deep-research workflow (103 agents, 25 claims 3-vote source-checked against legitimate
primary/author sources, 0 refuted) and integrated as books 8/9/10 with the trailing sections renumbered, the
placeholder removed, the status header updated, and the KB-integrity guard's book-count floor raised to 10. The
loader embeds the whole file, so the Coach reasons from all 10 books with no wiring change.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). The KB integrity guard (10-book floor + per-book operational format) and
buildSystemPrompt (KB still embedded) both run clean in that gate.

## The un-named reliance
- **The deep-research output's principles are correctly attributed to legitimate sources.** Relied upon; mitigated
  by the workflow's 3-vote adversarial source-checking (0 refuted) and by folding the attribution caveats
  (transparency-illusion is a gloss; cite dalecarnegie.com not a blog) into the KB's do-not-cite notes so the Coach
  does not over-quote or misattribute.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The 3 new books' worked examples use an INLINE 'Before: … / After: … / Why: …' format, while books 1-7 use a bulleted list. Cosmetic inconsistency.",
    "why_skipped": "Content-equivalent and fully readable by the LLM (the integrity guard asserts Before:/After: presence, which both formats satisfy). Reformatting 15 source-checked worked-examples risks transcription errors for zero functional gain; the LLM reasons from either shape identically.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-25T14:02:00+08:00",
    "outcome": "OPENED + confirmed cosmetic. The KB is consumed by an LLM as structured reference, not rendered for humans; both worked-example shapes carry the same Before/After/Why triplet the Coach matches against. No functional difference; left as-is to avoid error-prone reformatting of source-checked content."
  },
  {
    "id": "R2",
    "item": "The research's openQuestions: break out 'the And Stance' / 'contribution vs blame' as their own Difficult-Conversations subsections, and add machine-readable per-principle source tags for runtime citation.",
    "why_skipped": "Enhancements, not gaps — the And-Stance / contribution concepts are folded into Difficult-Conversations moves 2 and 5 (source-checked there), and the Coach cites sources from the prose **Source:** lines today. Per-principle source tags are a larger schema-shaped change (how the Coach attributes at runtime) worth a separate, founder-visible decision, not a silent add here.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
