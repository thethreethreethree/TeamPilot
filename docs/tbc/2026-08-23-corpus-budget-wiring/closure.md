# CLOSURE — wire the knowledge-corpus budget (INV22 re-starvation gap)

## What shipped
The unwired `corpusBudget.ts` guard is now wired end-to-end against the live re-starvation gap: both Sales
corpora (methodology + product), saved at up to 100k chars and injected RAW into the analysis/prep/QA prompts,
are now capped to the shared budget at SAVE (primary — stored ≤ budget, truncation reported) and defensively at
the 4 LLM-injection chokepoints (legacy corpora). The admin is told honestly when a corpus is trimmed. A
company with a rich corpus now gets a real coach read instead of empty AI (§3.4 / INV22).

## Verification (A38)
`npm run check` → EXIT 0 (see check.md for the pasted output). Targeted: 21 corpus tests green (6 capCorpus unit,
6 injection-chokepoint wiring, 2 save-route truncation, + the pre-existing route/security tests intact).

## The un-named reliance (what this build assumes)
- **The 24,000-char budget is a safe default, not a measured one.** The file's rationale (worst-observed reasoning
  ~2.6k tok) predates a per-tenant custom corpus at this size; methodology+product combine to ≈12k tok input.
  I believe that's safely under the starve threshold, but it is not empirically pinned against a live
  deepseek-v4-flash call with two maxed custom corpora. If a starved-empty recurs at ≤ budget, the number needs
  tightening — the wiring makes that a one-constant change.
- **Display paths intentionally show the FULL stored text** (strategy-library, GET routes). Since SAVE now caps,
  new stored corpora are ≤ budget anyway; a legacy >budget row would display full but inject capped — consistent
  enough, and honest (the admin sees everything stored).

## Residual (A36 — explicit, not silently dropped)
```json
[
  {
    "id": "R1",
    "item": "C.A.R.E product context is NOT routed through capCorpus",
    "why_skipped": "ai_product_context + ai_assistance_guidance are bounded at save by a TIGHTER z.string().max(8000) (~2k tokens each), already safe — routing them through the larger 24k cap would loosen, not tighten. The corpusBudget doc's 'both systems' line was aspirational; the reachable gap was Sales-only. Follow-up only if the C.A.R.E save cap is ever raised above the budget.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-23T14:06:00+08:00",
    "outcome": "OPENED + CONFIRMED. Traced getProductContextForTenant (config.ts:348) → care/prompt.ts:261 injects productContext raw, but its SOURCE is bounded: code-managed tenants get the fixed ELOSTATE_PRODUCT_KNOWLEDGE (~3.2k tok); editable tenants get aiProductContext (save-capped 8000). Worst editable case = aiProductContext(8000) + aiAssistanceGuidance(8000) + fixed SERVICE_PHILOSOPHY ≈ 4k tok user-editable, under the starve level. No raw unbounded user corpus reaches the C.A.R.E prompt — the Sales-only exclusion is correct."
  },
  {
    "id": "R2",
    "item": "The 24k-char budget is empirically unpinned for two maxed custom corpora",
    "why_skipped": "Safe by estimate (worst-observed reasoning ~2.6k tok), not by a live deepseek-v4-flash measurement with methodology+product both at budget (~12k tok combined input). If an empty-at-<=budget recurs, tighten KNOWLEDGE_CORPUS_MAX_CHARS — one constant, all sites.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  }
]
```
