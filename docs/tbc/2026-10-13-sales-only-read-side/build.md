# BUILD - the read side of sales-only

### The four per-call GETs answer a meeting as if nothing is stored

- **write-path:** `src/app/api/coach/sales-session/[id]/after-pitch/route.ts`, `[id]/summarize/route.ts`,
  `[id]/why/route.ts`, `sales-session/dissect/route.ts` (GET handlers).
- **read-path:** their `__tests__/route.test.ts`, new "on a meeting or huddle" cases (meeting and huddle; the store
  is not read for after-pitch and why).

### INVARIANT 34 is per handler and covers reads

- **write-path:** `scripts/invariant-audit.mjs` INVARIANT 34.
- **read-path:** `node scripts/invariant-audit.mjs` (mutation recorded in check.md).
