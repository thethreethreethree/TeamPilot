# CHECK — verification is a command (A38)

## Canonical command
```
npm run check
```
Result after the correction (F1 reverted, F2 kept): **exit 0** — `2497 passed | 15 skipped`.

## Targeted runs
```
npx vitest run src/lib/coach/extension/__tests__/llmErrorResponse.test.ts
  → 4 passed (LlmError surface restored: error === message, kind preserved; non-LLM → generic 502)
npx vitest run src/app/api/coach/extension/__tests__/summarize.route.test.ts
  → 7 passed (incl. empty summary → 502, the F2 guard)
```

## Verification findings
The check phase (the gate + targeted tests) surfaced **no findings** (no new defects). The two substantive
findings were
PRE-BUILD audit items, not check-phase findings, and are documented in think.md / closure.md:
- **F2** (empty summary false-empty) — real; fixed and kept.
- **F1** (the "CWE-209 leak") — a MISDIAGNOSIS; the LlmError surface is an intentional convention
  (`docs/audits/2026-07-31-cwe209-error-leak-sweep.md`). Reverted post-commit once the §1.2 record-check
  (skipped before F1) was performed. See closure.md CORRECTION.

## What "checked" means here, and what it does NOT
- Confirmed: `summarize` returns 502 on an empty result; the LlmError surface is back to the intentional
  `{error, kind}` and locked by a test so it isn't re-genericized.
- NOT done: no change to the ~25 other authed routes' intentional LlmError surface; the raw-upstream-body
  residual is a founder decision, not resolved here.
