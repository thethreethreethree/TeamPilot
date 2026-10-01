# CHECK - the AI provider's raw reply reached users

## Commands

```
$ npx vitest run src/lib/llm src/lib/coach/extension src/lib/coach/doorlog/__tests__/pitchFailureMessage.test.ts
      Tests  247 passed
exit 0

$ npm run invariant:audit
  Violations:           0
exit 0

$ (mutation: `error: err.message` restored in diagnosis/outside-view/route.ts, then in llmErrorResponse.ts)
  Violations:           1
exit 1   (each; both restored)

$ (mutation: report-card route returns pitch.error directly)
      Tests  1 failed | 7 passed (8)
exit 1   (restored)
```

The full `npm run check` is appended below.

## Findings

### Stored exception text was served to reps

class: raw exception text written to a column, then served by a route (laundered past CWE-209)
sweep: grep -rnE "(error|last_error|failure_reason):\s*`[^`]*\$\{[^}]*message" src/lib src/app/api
severity: medium

### 26 AI routes sent the provider's raw reply

class: an error type whose message is the upstream body, sent to the client as `error`
sweep: grep -rnE "error: err\.message" src/app/api src/lib
severity: medium

### The CWE-209 gate exempted the leak on a false premise

class: a gate exemption whose stated premise ("curated") was never true
sweep: grep -n "continue; //" scripts/invariant-audit.mjs, and for each exemption, check its premise in the code
severity: high

## Not verified

- No client screen was rendered with a real failed AI call; the change is to the response text only, and no
  client parsed the old text (grep of the website and the app).
- The stored-then-served sweep covered `pitches.error`; other job tables with an error column were not
  individually traced to their readers.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Appended — the full gate

```
$ npm run check
      Tests  5592 passed | 15 skipped (5607)
CHECK_EXIT=0
```
