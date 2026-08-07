# BUILD — what changed

> Net effect after the CORRECTION (see closure.md): **F2 kept, F1 reverted.** The two entries below reflect
> the final shipped state, not the intermediate F1 "fix".

### summarize empty-result guard (F2 — kept)
A successful summary engine call that yields an empty string must surface as a failure, not a blank
"caught up" (§3.4). Mirrors the copilot/formulate guards.
- write-path: `src/app/api/coach/extension/summarize/route.ts` — after `generateSalesSummary`, `if (!summary)`
  logs and returns `502` instead of `200 { summary: "" }`.
- read-path: the extension panel receives the 502 error state (never a blank success); asserted by
  `src/app/api/coach/extension/__tests__/summarize.route.test.ts` — the "empty summary → 502" case.

### llmError surface (F1 — reverted to the intentional convention)
The `{ error: err.message, kind }` LlmError surface is a deliberate authed-agent convention (2026-07-25;
classified intentional by `docs/audits/2026-07-31-cwe209-error-leak-sweep.md`). The intermediate F1 change that
genericized it was reverted; the branch is restored and annotated so it isn't re-broken.
- write-path: `src/lib/coach/extension/llmErrorResponse.ts` — the `instanceof LlmError` branch returns
  `{ error: err.message, kind: err.kind }` with the rate-limit→429 / else→(status ?? 502) mapping.
- read-path: the extension client shows the provider cause + `kind`; asserted by
  `src/lib/coach/extension/__tests__/llmErrorResponse.test.ts` — `error === "slow down"`, `kind` preserved.

## Not touched (deliberately — §1.5 / §3.3)
The ~25 other authed AI routes (incl. the 5 C.A.R.E extension routes) carry the same intentional LlmError
surface. Not changed — it is the established convention. The residual (raw upstream body inside `err.message`)
is surfaced to the founder as a codebase-wide policy question, not resolved unilaterally.
