# CHECK — CWE-209 raw-error-field sweep + fixes

## Verification run (A38 — canonical command + exit code)
```
$ npx vitest run "src/app/api/finance/forecast"
 Test Files  1 passed (1)
      Tests  2 passed (2)
VITEST_EXIT=0
$ npm run check
  Violations: 0
 Test Files  390 passed | 1 skipped (391)
      Tests  2683 passed | 15 skipped (2698)
CHECK_EXIT=0
```

## Findings

### F1 — finance/forecast returned the raw RPC error (and a wrong 403)
file+line: `src/app/api/finance/forecast/route.ts:36` (pre-fix) — `return NextResponse.json({ error: fc.error.message }, { status: 403 })`, where `fc = sb.rpc("fin_cash_forecast")`, so `fc.error.message` is the raw Postgres/RPC message; 403 also wrongly implied a permission issue.
class: CWE-209 raw-backend-error-to-client via a NESTED `.error.message` field (the standing `.message` invariant missed it because the error is nested under a Supabase result's `.error`).
severity: low — authed user; raw DB/RPC string (relation names on schema drift), not a secret.
sweep-command: `grep -rnE "error:\s*[a-zA-Z_]+\.(error|detail)\b" src/app/api` + hand-classification — see F2.

### F2 — knowledgeDocs leaked the raw insert error to the agent
file+line: `src/lib/care/knowledgeDocs.ts:147,180` (pre-fix) — `{ ok:false, error: error?.message ?? "…" }`, surfaced by `care/agent/acms/documents:74,98` as `{ error: result.error }`.
class: CWE-209 raw-backend-error-in-a-result-`.error`-FIELD — same class as xh's `target.error` and F1; invisible to the `.message`-keyed invariant.
severity: low — authed agent (admin-gated for retract); raw Supabase message, not a secret.
sweep-command: `grep -rnE "error:\s*[a-zA-Z_]+\.(error|detail)\b" src/app/api` — the whole-app sweep. Fixed at the source helper (covers both route call-sites).

## Audit-clean (non-defect) — the rest of the field-pattern hits
Every other `{ error: X.(error|detail) }` hit was read and is CONTROLLED: `auth.error`/`ctx.error`/`c.error`
(curated auth-gate strings), `v.detail` (upload validation), `parsed.error.issues[].message` (Zod validation
text), and `refreshExtensionSession`'s three curated returns. No finding — recorded so the bounded, classified
result is on the record (an empty result stated explicitly beats silence).
