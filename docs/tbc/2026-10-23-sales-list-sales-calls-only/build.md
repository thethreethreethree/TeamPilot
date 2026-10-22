# BUILD - the sales list shows sales calls only

### The list query leaves meetings and huddles out

- **write-path:** `src/app/api/coach/sales-session/list/route.ts` (`.not("session_kind", "in", "(meeting,huddle)")` before the 300 limit).
- **read-path:** `src/app/api/coach/sales-session/list/__tests__/route.test.ts` (rep and manager both filtered).
