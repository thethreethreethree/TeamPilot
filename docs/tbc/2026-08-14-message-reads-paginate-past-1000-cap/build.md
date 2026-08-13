# BUILD — page the message reads past the 1000-row cap

### fetchMessages (team chat) — page past the cap
read-path: `src/lib/data/chats.ts` — `fetchMessages` reads `chat_messages` for a topic.
write-path: none (read). The unbounded `.select().order(created_at)` is replaced by `fetchAllPaged` inside the
existing `Promise.all` (with pins): pages `.range` windows with a secondary `.order("id")` for deterministic
paging, throws honestly on error (preserving the INV22 error-not-empty guard). A new `ChatMessageRow` type +
two casts (`kind` union, `ai_assisted ?? false`) replace the old loose supabase typing.

### listCareMessagesForCustomer (C.A.R.E support) — page past the cap
read-path: `src/lib/data/care.ts` — reads `support_messages` for a conversation (non-internal).
write-path: none (read). Same fetchAllPaged wiring (already-imported), secondary `.order("id")`, throws on
error (the widget route turns the throw into a 500 — no empty-flash). `mapMessage` (Record<string,unknown>)
unchanged.

## Test coverage
- `chats.pagination.test.ts` (NEW, 1): a thread with a full page (1000) + a short page (5) returns ALL 1005 and
  the newest message is present — a reverted unbounded read would cap at 1000 and fail.
- `chats.errorState.test.ts`: updated for the paged path (mock gains `.range`; the throw message follows
  fetchAllPaged's label) — the INV22 throw-on-error property is retained.
- `care/.../messages/errorState.test.ts`: unchanged (mocks the function; the throw → 500 still holds).

## Out of scope (noted follow-up)
The lower-reach `tasks.ts` per-task message reads (a task rarely exceeds 1000 messages) share the class but were
not part of this founder-scoped fix; flagged for a later pass.
