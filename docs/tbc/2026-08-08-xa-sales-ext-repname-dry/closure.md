# CLOSURE — DRY the rep-name lookup across the 5 sales extension routes

## What shipped
`resolveRepName(userId)` — the single implementation of the best-effort rep-name lookup the 5 sales extension
routes (dissect/coach/summarize/copilot/formulate) each duplicated verbatim. Each route now calls the helper;
~55 lines of duplication removed; behavior identical; the fallback contract test-locked.

## Un-named reliance (not self-evident)
- **Behavior is preserved LINE-FOR-LINE.** The helper does exactly what the inline block did: admin
  `profiles.full_name` lookup, trim, generic "the sales rep" fallback on blank/missing/error, never throws.
  Do not "improve" it (e.g. throw on error, or drop the generic fallback) — the routes rely on it never
  blocking the tool and never fabricating an identity.
- **The route tests still cover the threading BECAUSE the mock path is unchanged.** The helper imports
  `createAdminClient` from `@/lib/supabase/admin`, the same module the route tests mock — so the mock
  intercepts the helper and the "repName threaded to the engine" assertions still hold without editing those
  tests. If the helper's import path ever changes, those route tests' mock would stop intercepting it.
- **INV24 correctly ignores repName.ts.** It references no LLM caller (dissectCoachV5/generateCareReply), so
  it injects no external text and needs no CONVERSATION_IS_DATA fence — the invariant's LLM-caller trigger is
  precisely why a pure util file there is not flagged.
- **The C.A.R.E extension routes still inline their own agentName lookup.** They were left untouched (lower
  blast radius); a future pass could adopt a generic `resolveExtensionUserName(userId, fallback)` for both,
  but that would touch 5 working C.A.R.E routes and is not needed now.

## Flagged, not fixed (§3.3)
- The C.A.R.E extension routes' equivalent inline agentName lookup could adopt a shared helper too — a
  follow-up DRY, not required now (it touches working code with a different fallback label).

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "The 5 C.A.R.E extension routes still inline the same-shaped agentName lookup (fallback 'the support agent').", "why_skipped": "Extracting a generic resolver for both would touch 5 working C.A.R.E routes for no behavior change; the sales-side duplication (this session's own output) was the one worth removing now. Low value, non-zero risk.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-08T05:34:00Z", "outcome": "OPENED — optionally generalize to resolveExtensionUserName(userId, fallback) for both extensions in a future DRY pass." }
]
```
