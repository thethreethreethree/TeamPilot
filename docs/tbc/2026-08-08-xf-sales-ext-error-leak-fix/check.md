# CHECK — verification is a command (A38)

## Canonical command
```
npm run check
```
Result this build: **exit 0** — `2497 passed | 15 skipped` (full log `/tmp/c4.log`).

## Targeted runs (the two findings)
```
npx vitest run src/lib/coach/extension/__tests__/llmErrorResponse.test.ts
  → 5 passed (incl. the CWE-209 no-leak test: response body excludes "DeepSeek" + raw detail; cause logged)
npx vitest run src/app/api/coach/extension/__tests__/summarize.route.test.ts
  → 8 passed (incl. empty summary → 502)
```

## What "checked" means here, and what it does NOT
- Confirmed: the helper no longer returns `err.message`; the empty-summary path returns 502; both are locked
  by tests that fail on regression (the old rate-limit test asserted the leaky string — it now asserts the
  generic one, so a revert would fail).
- NOT confirmed by this build: the 4 C.A.R.E inline copies still leak (out of scope — founder-gated flag).
  The browser client is unchanged by this build.
