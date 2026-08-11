# BUILD — CWE-209 data-layer altitude sweep + chats fix

### chats.fetchTopics returns a generic live-error string (`chats.ts:542`)
- write-path: on a read error, `fetchTopics` still `console.error`s the raw `${code}: ${error.message}`
  (diagnostic) and still returns `{ topics:[], mode:"live-error" }` (INV22 error-vs-empty), but the client
  `error` field is now the generic "please try again in a moment" instead of the raw Postgres code+message.
- read-path: `chats/page.tsx:103` renders `Could not load topics — ${res.error}` → now a generic reason, no
  schema/relation name. Locked by `chats.fetchTopics.test.ts` (updated): asserts `mode === "live-error"` AND
  `error` does NOT contain "42P01"/"view is stale" AND equals the generic string — the assertion that
  previously LOCKED the leak now locks the fix.
