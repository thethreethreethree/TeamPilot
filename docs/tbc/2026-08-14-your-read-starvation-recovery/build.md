# BUILD — "Your read" starvation recovery + remove the length cap

### generateSalesReview retries leaner on an empty read (starvation recovery)
read-path: `src/lib/coach/v5/salesReview.ts` — the LLM call is now `runOnce(systemPrompt)`; a first attempt uses
the full prompt (company corpus + product), and on an EMPTY/no-signal result it retries with the LEAN built-in
prompt (no corpus/product).
write-path: none (it returns a SalesReview; the caller persists it). Both attempts still `console.error` the miss
(INV22 visibility). Only when BOTH starve does the honest EMPTY_REVIEW survive. The transcript + the
`MIN_AGENT_SEGMENTS=1` gate are unchanged.

### remove the "very short exchange" length cap (after-pitch fallback)
read-path: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` blank-narrative fallback.
write-path: none (copy). Replaced "…a very short exchange may not have enough to write a full read." with a
"your read is being rebuilt → scores/focus are real feedback → tap Rebuild" line — no length excuse (founder: no
minimum length, every call gets a read).

## Test coverage
`src/lib/coach/v5/__tests__/salesReview.generate.test.ts` (+1, 2 updated): a first EMPTY attempt is retried
leaner and the valid retry returns the read (hasSignal true, 2 debrief calls); when BOTH attempts starve, the
honest empty survives and EACH miss is logged; an unparseable response is likewise retried.

## Out of scope (flagged)
- The dissect engine (`salesDissect`) has the SAME starvation shape (its own debrief-style call); applying the
  retry there is a flagged follow-up (a separate section from the founder's visible "Your read").
- The account investigation confirmed NO per-account limitation (both admin + Standard); nothing to remove there.
