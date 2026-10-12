# BUILD - sales coaching on sales calls only

### One verdict: isSalesCall

- **write-path:** `src/lib/coach/v5/salesOnly.ts` `isSalesCall`, `NOT_A_SALES_CALL`.
- **read-path:** every guard below branches on it.

### The two shared entry points refuse a meeting or huddle

- **write-path:** `generateSessionArtifacts.ts` (returns all-null, no engine runs); `generateAndStoreAfterPitch.ts`
  (`notASalesCall: true`, no read, no points).
- **read-path:** `__tests__/generateSessionArtifacts.test.ts` and `__tests__/generateAndStoreAfterPitch.test.ts`
  "not a sales call" (meeting and huddle; no engine, no bankSessionPoints).

### The routes and the backfill

- **write-path:** after-pitch, summarize, why, ask-coach, summary-scores, sales-session/dissect answer 409
  NOT_A_SALES_CALL; attribute-unlabelled uses isSalesCall; `dissectBackfill.ts` selects `session_kind = 'sales'` only.
- **read-path:** route tests (fixtures now carry `sessionKind: "sales"`); INVARIANT 34 in `scripts/invariant-audit.mjs`.
