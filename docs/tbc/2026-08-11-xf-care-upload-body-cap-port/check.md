# CHECK — C.A.R.E upload body-cap port (F2)

## Verification runs (A38 — canonical commands + exit codes)

**Routes + typecheck (existing CARE tests must not regress; new finalize-gate tests must lock the security):**
```
$ npx vitest run "src/app/api/care/conversations"
 Test Files  11 passed (11)
      Tests  46 passed (46)
VITEST_EXIT=0
$ npm run typecheck   # tsc --noEmit
TYPECHECK_EXIT=0
```
36 pre-existing tests still pass (no regression from the shared-tail refactor); the 10 new tests lock the two
security gates on BOTH routes: cross-company `storagePath` → 403 before the admin read, object-not-found →
404, REAL stored type disallowed → 400, REAL size over cap → 400, and the in-company happy path records the
REAL stored size/type (not the client's claim).

## Proactive scan (§1.5.2) — did the class sweep leave any other body-cap upload?
Grepped every route that does `req.formData()` and writes to the ASSETS bucket:
```
$ grep -rl "req.formData()" src/app/api | grep -iE "upload|files|care|coach"
```
- `care/conversations/[id]/upload` + `agent-upload` — **fixed here** (both now expose a signed/JSON branch;
  multipart kept as fallback).
- `coach/sales-session/[id]/upload-recording` — already ported (this session's prior build).
- `api/files` — its LARGE-file path already goes through the signed `/api/files/upload-url` flow (the
  folder-zip / large-file caller); its direct `FileDropzone` multipart path is for small files. Out of F2's
  scope (a different product surface, not a C.A.R.E conversation upload) and NOT newly broken by this change.
- The deliberately-≤4 MB text-extract routes (`sales-session/extract`, `coach/extension/extract`,
  `care/agent/acms/extract`) are intentionally small (a 4 KB/`MAX_EXTRACT` literal) — correctly NOT ported.

## Findings

**No findings.** This build IS the remediation of a previously-recorded finding (audit F2), implemented by
mirroring the proven recording-upload pattern; the two security gates it introduces (cross-company prefix,
real-object re-validation) are each locked by a test on each route. Known NON-defect boundaries (carried to
the residual, not defects):
1. The signed flow depends on the browser reaching Supabase Storage directly (`uploadToSignedUrl`). If a
   customer's network blocks the storage host, the upload fails with a generic retry message — strictly
   better than the silent through-function failure it replaces (which failed for EVERY >4.5 MB file).
2. The A30 structural gate for the class (an ASSETS-bucket `formData()` route lacking a `storagePath` branch)
   is deferred — see closure residual R1 — because the detection surface is still heterogeneous (three cap
   mechanisms); the proposal named this A33 hole and it remains named until the pattern is uniform.
