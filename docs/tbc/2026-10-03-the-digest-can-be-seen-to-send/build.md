# BUILD - the digest can be seen to send

### One verdict for "email can send"

- **write-path:** `src/lib/care/email/configured.ts`; `weeklyDigest.ts` (both orchestrators) calls it.
- **read-path:** `src/lib/care/email/__tests__/configured.test.ts`.

### /api/health says whether email can send

- **write-path:** `src/app/api/health/route.ts` `capabilities.email`.
- **read-path:** `src/app/api/health/__tests__/route.test.ts` "email"; `curl https://elostate.com/api/health`.

### The founder's setup step is on the record

- **write-path:** `docs/CONFIG-PRECONDITIONS-AUDIT.md` (2026-10-03 section), `docs/OPS-ENV-CHECKLIST.md` rows.
- **read-path:** the founder; step 5 there is the check.
