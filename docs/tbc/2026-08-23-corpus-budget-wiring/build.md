# BUILD — wire the knowledge-corpus budget (INV22 re-starvation gap)

### capCorpus becomes a wired, pure guard (was untracked, unwired dead code)
- write-path: `src/lib/llm/corpusBudget.ts` — dropped `import "server-only"` (pure string fn; server-only would
  break any transitively client-imported prompt builder); corrected the doc's aspirational "used at BOTH…" line
  to name the ACTUAL wired sites; committed the file (previously `??`).
- read-path: `capCorpus(content)` returns `{ content (≤ budget, cut at a clean boundary), truncated, originalChars }`.

### the LLM injection chokepoints cap the corpus (defensive — protects legacy corpora)
- write-path: `capCorpus(...).content` at all four raw-injection sites — `methodologyBlock` (salesReviewPrompt.ts,
  covers dissect/moments/pivot/review/score + copilot/formulate), `reviewProductBlock` (prepShared.ts, same set),
  `buildPrepSystemPrompt` (salesPrep.ts), `buildQASystemPrompt` (salesPrepQA.ts).
- read-path: a company with a >24k-char corpus now gets a real read/dissect/prep instead of empty AI, because the
  emitted system prompt can no longer blow past the reasoning model's 8000-token output clamp.

### the corpus SAVE routes cap at ingestion + report truncation (primary defense)
- write-path: `/api/coach/sales-session/corpus` + `/product` — `capCorpus(body.content)` → store capped content;
  response carries `{ truncated, originalChars, storedChars }` when it fired.
- read-path: new corpora are ≤ budget at rest, so EVERY downstream injection (incl. any future brain) is safe by
  default — the save cap is the real chokepoint, the load caps are belt-and-suspenders for legacy rows.

### the admin is told when a corpus is trimmed (§3.4 honesty — residual closed)
- write-path: `src/app/dashboard/sales-coach/settings/page.tsx` — both save handlers read the response; on
  `truncated`, an `info` toast states original vs used char counts ("Saved — trimmed to fit").
- read-path: the admin learns their tail was dropped and can trim what matters, instead of silently losing it.

## Files
- `src/lib/llm/corpusBudget.ts` (de-server-only'd + doc; now committed)
- `src/lib/coach/v5/salesReviewPrompt.ts`, `prepShared.ts`, `salesPrep.ts`, `salesPrepQA.ts` (cap at injection;
  the two prep builders exported for the A30 gate)
- `src/app/api/coach/sales-session/corpus/route.ts`, `product/route.ts` (cap at save + truncated response)
- `src/app/dashboard/sales-coach/settings/page.tsx` (truncation toast, both handlers)
- tests: `src/lib/llm/__tests__/corpusBudget.test.ts` (NEW, 6), `src/lib/coach/v5/__tests__/corpusCap.wiring.test.ts`
  (NEW, 6), corpus + product route tests (+1 each: over-budget save caps + reports truncation)

## Ripple (holistic — §6 item 5)
- Display/edit paths (strategy-library, corpus/product GET) DELIBERATELY untouched — the admin must see the full
  stored text; capping is only on the LLM-injection + save paths.
- `server-only` removed from a pure fn is safe: it was never providing a real guard (no secrets/IO), and the
  files that import it are server engines anyway.
- Budget unchanged (24k chars ≈ 6k tok): larger than every built-in KB, safely under the starve level; per-corpus,
  so methodology+product combine to ≈12k tok — within the model's safe reasoning margin.
- No schema/migration (a query-time + save-time cap on existing columns); no external config.
