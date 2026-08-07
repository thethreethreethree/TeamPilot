# CLOSURE

## ⚠️ CORRECTION (appended after commit — F1 was a misdiagnosis, reverted)

**F1 (the CWE-209 "fix") was WRONG and has been reverted.** After committing, a proper class-boundary sweep
(A26) — which should have run BEFORE the fix — showed the `{error: err.message, kind}` LlmError surface is a
UNIFORM, DELIBERATE convention across ~25 authed AI routes, already classified **intentional** by the completed
full-app CWE-209 sweep `docs/audits/2026-07-31-cwe209-error-leak-sweep.md` (rule: "keep any `instanceof
LlmError` curated branch UNTOUCHED"; the provider-cause surface to a trusted same-tenant agent is a 2026-07-25
design decision). My F1 change diverged the sales extension from that convention. The failure: I acted on a
confident audit-agent finding under the build-continuation guard's pressure WITHOUT the retrospective
record-check (§1.2 / §0.1) — the exact §0/§5 "confident well-formed wrong answer under pressure" this
constitution exists to catch. F1 reverted; the LlmError branch is restored + annotated so it isn't re-broken.

**F2 (empty-summary → 502) is KEPT** — it never touched the LlmError branch; it's a separate, legitimate §3.4
honesty fix that aligns sales `summarize` with its siblings copilot/formulate and the route's own contract.

Residual surfaced to the founder (a real, codebase-wide decision — NOT mine to make): the intentional provider
surface also carries the raw upstream body (`rawBody.slice(0,200)`) inside `err.message`, so the AI vendor name
+ upstream detail reaches the authed agent. Trimming just the raw body while keeping kind/provider is a
one-place, codebase-wide policy change if the founder wants it.

---

## What shipped
The sales extension's generative error path no longer leaks raw provider detail to the client (CWE-209) and
logs the real cause server-side; the summarize route no longer emits a false-empty "caught up". Both locked
by tests.

## Residuals — founder-gated
1. **The 4 C.A.R.E extension routes carry the identical `err.message` leak** (inline, never adopted the shared
   helper): `care/extension/summarize/route.ts`, `copilot/route.ts`, `formulate/route.ts`, `coach/route.ts`.
   The clean fix is to point them at `llmErrorResponse` (which now also lives correctly) — one edit each,
   mechanical, and it removes the duplication the helper's docstring was created to prevent. Held for founder
   go-ahead because it changes the shipping C.A.R.E product; I will not rewrite it under the continuation
   guard without an explicit yes.
2. **Client `kind` usage:** the sales content.js does not yet branch on `data.kind` (e.g. a distinct
   "AI is busy, try again" on rate_limit). Low value; the status code already drives correct behavior.

## Residuals (schema'd — A36)
```json
[
  {
    "id": "R3-other-routes-intentional-surface",
    "item": "The ~25 other authed AI routes (incl. the 5 C.A.R.E extension routes) keep the {error: err.message, kind} LlmError surface; unchanged by this build.",
    "why_skipped": "It is the established, deliberate 2026-07-25 convention — not this build's scope and not mine to change unilaterally.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-08T07:50:00Z",
    "outcome": "Opened per A36 (the residual I'm most sure is irrelevant is where I'm most likely wrong — which is exactly how F1 happened). Re-read docs/audits/2026-07-31-cwe209-error-leak-sweep.md this session: it classifies every `instanceof LlmError` surface intentional and rules 'keep the branch UNTOUCHED'. Confirmed — no action needed; leaving them keeps consistency. The correct move was NOT to sweep-fix them but to revert my divergent F1."
  },
  {
    "id": "R2-care-summarize-empty-guard",
    "item": "C.A.R.E summarize lacks the F2 empty-result guard that sales summarize now has.",
    "why_skipped": "Low-severity honesty-consistency item on the shipping C.A.R.E product; bundling it would expand scope mid-correction.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  },
  {
    "id": "R1-raw-upstream-body-in-message",
    "item": "The intentional LlmError surface carries the raw upstream body (rawBody.slice(0,200)) inside err.message, so the AI vendor name + upstream detail reaches the authed agent.",
    "why_skipped": "Trimming the raw body while keeping kind/provider is a codebase-wide policy change and a founder decision, not a per-route fix under the guard.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```

## Un-named reliance (the half that's easy to skip)
- This fix relies on `err.message` / `err.rawBody` being the ONLY carriers of raw provider text — if a future
  `LlmError` subclass adds another raw field and a route returns it, the leak reopens. The chokepoint
  (`llmErrorResponse`) is the defense; any NEW generative extension route must route errors through it, not
  hand-roll a response. (No invariant enforces "generative extension routes must use llmErrorResponse" — that
  remains a discipline, not a guard. A candidate future INV if a third such route appears and hand-rolls.)
- The CWE-209 test asserts absence of two specific strings ("DeepSeek", "internal detail"); it is a
  representative check, not a proof that no provider string can ever appear. The structural guarantee is that
  the response `error` is `opts.fallbackMessage` — a constant — which the test also asserts.
