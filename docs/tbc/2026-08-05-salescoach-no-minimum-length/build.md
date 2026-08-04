# BUILD — Sales Coach: no minimum length, every session gets all content

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match the top-level `docs/tbc/DOC_MANIFEST.json`; no governing-doc change, so no AMD required.

## Change

### Prompt refusals removed — always generate, still grounded
`salesReviewPrompt.ts`, `salesScorePrompt.ts`, `salesDissectPrompt.ts`, `salesMomentsPrompt.ts`,
`salesPivotPrompt.ts`, `salesWhy.ts` (inline prompt).

- **write-path:** each system prompt's "if too thin, return `hasSignal:false`/empty" instruction is
  replaced with "ALWAYS return `hasSignal:true` with at least one grounded item for EVERY session
  regardless of length", and the output-shape `"hasSignal"` field is pinned to `true`. The §3.4
  ground-in-a-real-transcript / no-fabricated-quote-or-stat rules are kept verbatim.
- **read-path:** each engine parses the model JSON and, because the model now returns `hasSignal:true`
  + content, surfaces it: `narrative` → "Your read" and `scores` → the LLM score categories on the
  After-Pitch page (`after-pitch/page.tsx`, rendered by `.length` / `hasSignal`); `dissect` → the Dissect
  surface; `moments`/`pivot`/`why` → their respective sections. A short-but-real call now renders full
  content instead of the "too short to read" empty state.

### Engine length floors lowered to a genuine-empty floor
`salesReview.ts`, `salesScore.ts`, `salesMoments.ts`, `salesDissect.ts`, `salesPivot.ts`,
`salesWhy.ts`, `salesIntel.ts`.

- **write-path:** each `MIN_AGENT_SEGMENTS`/`MIN_SEGMENTS` constant is set from `3`/`4` to `1`, with a
  comment recording the founder 2026-08-05 decision. The gate expression is unchanged
  (`length < MIN`), so `length < 1` now means "only a genuinely empty side" — no "minimum time".
- **read-path:** `generate*()` now calls the LLM and returns content for any session with ≥1 relevant
  turn; only a 0-turn rep side (capture gap) or 0-segment transcript short-circuits to the honest empty
  state. The composite `afterPitch.ts` `hasSignal` (narrative || moments || scores || cueLoop) is
  therefore satisfied for every real call, so the page's top-level "No conversation captured" gate no
  longer fires on a short pitch.

### Test contract updated to the new behavior
`src/lib/coach/v5/__tests__/salesReview.generate.test.ts`.

- **write-path:** the `< 3 agent turns → empty, no LLM call` test is replaced by two tests — a 0-agent-turn
  capture gap still short-circuits before the LLM, and a 2-agent-turn short call now DOES call the LLM and
  returns a real read. The doc block is rewritten to the founder 2026-08-05 contract.
- **read-path:** `npx vitest run` executes them; both pass, locking the new "no minimum time" behavior so a
  future edit can't silently reintroduce the floor.

## Files
- `src/lib/coach/v5/salesReviewPrompt.ts`
- `src/lib/coach/v5/salesScorePrompt.ts`
- `src/lib/coach/v5/salesDissectPrompt.ts`
- `src/lib/coach/v5/salesMomentsPrompt.ts`
- `src/lib/coach/v5/salesPivotPrompt.ts`
- `src/lib/coach/v5/salesReview.ts`
- `src/lib/coach/v5/salesScore.ts`
- `src/lib/coach/v5/salesMoments.ts`
- `src/lib/coach/v5/salesDissect.ts`
- `src/lib/coach/v5/salesPivot.ts`
- `src/lib/coach/v5/salesWhy.ts`
- `src/lib/coach/v5/salesIntel.ts`
- `src/lib/coach/v5/__tests__/salesReview.generate.test.ts`
