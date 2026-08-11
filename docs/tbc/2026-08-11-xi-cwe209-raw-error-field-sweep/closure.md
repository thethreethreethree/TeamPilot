# CLOSURE — CWE-209 raw-error-field sweep + fixes

## What shipped
Completed the raw-error-FIELD CWE-209 sweep to its whole-app boundary (A26) — the class xh surfaced on the
sign surface, generalized: a `{ ok:false, error }` result object carrying a raw backend string in its `.error`
field, returned as `{ error: result.error }`, invisible to the `.message`-keyed invariant. Two real leaks found
and fixed: `finance/forecast` (`fc.error.message`, also mis-statused 403 → 500) and `knowledgeDocs`
(`error?.message` fallback surfaced by `acms/documents`). Every other field-pattern hit was read and confirmed
controlled. A finance/forecast test gates F1; the knowledgeDocs helper returns only literal strings (a grep
for a residual `.message` in its `.error` returns nothing).

## Un-named reliances (A35 — name them)
- **The `.(error|detail)` grep across src/app/api is the sweep's completeness basis.** It catches the field
  pattern; a leak that reaches the client through a DIFFERENTLY-named field (e.g. `{ error: r.cause }`) would
  not be caught by this exact pattern — but the classification step reads each result-object helper, so a new
  wrapper would surface on the next sweep.
- **The generic strings are literals.** The knowledgeDocs "promise" (no gate) relies on the returned `.error`
  staying a literal; the same grep re-run is the cheap re-check.
- **finance/forecast is authed.** The leak was authed-user-facing (not public), which is why it's LOW; the fix
  removes it regardless of caller trust.

## Residual (A36 — ranked by confidence-it-does-not-matter; top must be OPENED)
```json
[
  { "id": "R1", "item": "A raw backend string reaching the client through a result-object field NOT named error/detail (e.g. .cause / .reason / .hint).", "why_skipped": "The sweep grep keys on .error|.detail; a differently-named wrapper field would slip it.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-11T18:20:00Z", "outcome": "Grepped src/app/api for `error:\\s*[a-zA-Z_]+\\.(cause|reason|hint|stack)` and `{ error: [a-zA-Z_]+ }` bare-identifier returns — no result-object wrapper surfaces a raw backend string through an alternate field; the raw-string wrappers in the codebase expose it via .message or .error, both now covered (xh + this build). No further alternate-field leak found." },
  { "id": "R2", "item": "Widen the CWE-209 invariant to also catch custom { error }/{ detail } FIELD returns, not only .message.", "why_skipped": "Widening risks false-positives on every route that legitimately returns a controlled { error: '...' } string or a validated result.error; needs its own design + allowlist pass (A33 — don't ship a noisy gate). Named across xh R2 and here.", "confidence_it_does_not_matter": "medium", "opened_at": null }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations: 0
tbc ✓ — docs · manifest (13) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 390 passed | 1 skipped (391); Tests 2683 passed | 15 skipped (2698)
CHECK_EXIT=0
```
