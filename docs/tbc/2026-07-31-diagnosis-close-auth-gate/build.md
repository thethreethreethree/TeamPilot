# BUILD — auth gate on diagnosis/close

### close-the-loop auth gate

The route now requires a signed-in user before it will reach `close_problem()`. Matches the
`outside-view` / `ripple-trace` pattern verbatim (the 2026-07-09 audit installed the same gate on
those). The existing `createClient()` was hoisted out of the try block so a single client serves
both the `auth.getUser()` check and the RPC.

- **write-path:** POST `/api/diagnosis/close` → `supabase.auth.getUser()`; if no `user`, return 401
  ("Not authenticated.") BEFORE any RPC. When authenticated, `supabase.rpc("close_problem", …)`
  performs the atomic insert-resolution + mark-resolved + emit-event (unchanged). An anon caller
  never reaches the write to the append-only resolutions + events chain (Rule 3.1).
- **read-path:** the route returns `{ resolutionId }` (unchanged happy path) to the caller,
  `src/app/dashboard/diagnose/page.tsx`, which reads it after posting the chosen resolution. The
  new 401 branch is unreachable for that authenticated caller, so the dashboard read-path is
  unchanged.

Files:
- `src/app/api/diagnosis/close/route.ts` — added the `auth.getUser() → 401` gate; hoisted
  `createClient()`.
- `src/app/api/diagnosis/close/__tests__/route.test.ts` — added the anon-401 detection test;
  updated the mock helper to supply an authenticated user by default.
