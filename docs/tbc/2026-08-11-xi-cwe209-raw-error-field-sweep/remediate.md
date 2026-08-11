# REMEDIATE — CWE-209 raw-error-field sweep

### F1 — finance/forecast raw RPC error + wrong status
fix: `console.error` the raw `fc.error.message` (user-scoped) + return a generic 500 (was `{ error: fc.error.message }` at 403). `finance/forecast/route.ts:36`.
gate-or-promise: gate. `src/app/api/finance/forecast/__tests__/route.test.ts` asserts an RPC error yields 500 with a body containing neither "fin_cash_forecast" nor "relation", plus the 401-unauth path — fails if a future edit re-exposes the raw error.

### F2 — knowledgeDocs raw insert error
fix: `console.error` the raw cause + return a generic literal message in both `addKnowledgeVersion` and `retractKnowledge` (dropping the `error?.message` fallback). `knowledgeDocs.ts:147,180`.
gate-or-promise: promise. The helper now returns only literal strings in its `.error` (grep-verified: no `.message` interpolation remains in the returned field). A data-layer unit test would need a full Supabase-insert mock; the literal-only return is the durable property and is cheaply re-checkable by the same sweep grep. Named rather than gated with a heavy mock (A33 — don't add a brittle test for a property a grep verifies).
