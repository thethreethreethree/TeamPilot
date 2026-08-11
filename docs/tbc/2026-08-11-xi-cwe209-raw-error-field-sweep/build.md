# BUILD — CWE-209 raw-error-field sweep + fixes

### knowledgeDocs helper returns a generic message (`knowledgeDocs.ts:147,180`)
- write-path: `addKnowledgeVersion` / `retractKnowledge`, on an insert error that isn't the 23505 domain case,
  `console.error` the raw Supabase message (company-scoped) and return `{ ok:false, error: "<generic>" }` —
  dropping the prior `error?.message` raw fallback. The curated domain returns ("The file is empty.", "File too
  large…", "Another upload just landed…") are unchanged.
- read-path: `care/agent/acms/documents` (POST + DELETE) returns `{ error: result.error }` to the agent — now a
  generic string, never the raw DB message. The raw cause is readable only in the server log.

### finance/forecast returns a generic 500 on RPC error (`finance/forecast/route.ts:36`)
- write-path: on `fc.error` (the `fin_cash_forecast` RPC), `console.error` the raw `fc.error.message`
  (user-scoped) and return `500 { error: "<generic>" }` — replacing `{ error: fc.error.message }` at 403.
- read-path: the client receives the generic string + a correct 500; the raw RPC error is log-only. Locked by
  `__tests__/route.test.ts` (RPC error → 500, body contains neither "fin_cash_forecast" nor "relation"; plus
  the 401-unauth path).
