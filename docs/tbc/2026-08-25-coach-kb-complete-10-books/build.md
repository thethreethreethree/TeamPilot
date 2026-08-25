# BUILD — complete the Coach v5.0 Knowledge Base to 10/10 books (D6)

### the 3 source-checked book sections (deep-research output → KB)
- write-path: `docs/COACH_KNOWLEDGE_BASE.md` — inserted the deep-research workflow's 3 source-checked sections as books
  **8. Carnegie** (6 named moves), **9. Gladwell** (4 diagnostic cautions), **10. Difficult Conversations** (5
  moves), each `## N. Title — Author` + `**Source:**` + numbered `### principle` with the 4 fields. Renumbered
  Convergences 8→11, How-to-Use 9→12, Refuted 11→13; deleted the stale not-yet-confirmed-books placeholder; folded the
  convergence note in as section 11.6; updated the status header (7/10→10/10), the one "(section 8)→(section 11)" cross-ref,
  and swapped the "must-not-cite Carnegie/Gladwell/Stone" line for the attribution cautions from the research caveats.
- read-path: `getKnowledgeBase()` reads the whole file → every Coach call now embeds 10/10 source-checked books; the Coach
  matches a draft against any of the 15 new principles + the 7 prior books, and cites source-checked primary sources.

### the completion gate (KB integrity guard floor)
- write-path: `knowledgeBase.test.ts` — book-count floor raised 7→10 (regression floor: a dropped book fails).
- read-path: the guard now asserts all 10 books present AND each carries the operational principle format — a
  truncation or malformed edit fails the gate.

## Files
- `docs/COACH_KNOWLEDGE_BASE.md` — +3 source-checked books, renumbered sections, status/do-not-cite/convergence updated.
- `src/lib/coach/v5/__tests__/knowledgeBase.test.ts` — book-count floor 7→10.
- (integration performed by a temp asserted script that source-checked the 10-book count; script deleted, not committed.)

## Verification of the content (source discipline — §5)
Deep-research: 103 agents, 0 errors, 25 claims 3-vote source-checked, **0 refuted / 0 unverified**. Sources are primary/
author: dalecarnegie.com + Carnegie public-domain text; Hachette/Little-Brown + Gladwell interview + Levine's
Truth-Default Theory; Harvard PON + Sheila Heen. Gladwell framed correctly as diagnostic (cautions, not tactics).
Attribution caveats (transparency-illusion gloss; cite dalecarnegie.com not a blog) are recorded in the do-not-cite
notes, not lost.

## A26 boundary
The KB-integrity class (whole-file-embedded KB with no structural guard) was already swept to both KBs this session
(coach 54ebaaf7, sales dbc1f23a). This build raises the coach-KB floor to the full 10; no new instances of the class.

## Ripple (holistic — §6 item 5)
- Content + a test-floor bump; no loader/route/schema/logic change (buildSystemPrompt.test unchanged — it asserts
  the KB still embeds).
- Per-call token cost rises (~9k→~13k) — the accepted design (full KB inline; the founder opted in). No cap by design.
- Cross-refs audited: only "(section 8)" needed updating; book-internal N.M refs (books 1-7) unchanged.

## Honest limit
Content is timeless (1936–2019 texts); the openQuestions from the research (whether to break out "the And Stance" /
"contribution vs blame" as their own subsections; machine-readable per-principle source tags) are enhancements, not
gaps — the framework concepts are folded into moves 2 and 5. Not built now; noted in closure residual.
