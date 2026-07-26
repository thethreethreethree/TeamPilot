# Files subsystem — access-control audit (§1.7), 2026-07-26

Outside-view stance (§1.3). Target: IDOR (fetch another tenant's file by id) + privilege escalation
(grant yourself access to a file you don't own) + cross-tenant write. A fresh target — the files subsystem
was not in the recent audit rotation (auth/RLS 07-25, email 07-24, care 07-24, RCD + finance 07-26).
**Result: SOUND on every vector.** No code changed.

## The discipline that makes it sound
Every route that uses the **service-role admin client** (which bypasses RLS) pairs it with an **explicit
ownership check**; every route WITHOUT an explicit check uses the **session client** (RLS-enforced). The
two are never mixed the wrong way. Verified route-by-route:

| Route / op | Client | Gate | Verdict |
|---|---|---|---|
| `files/[id]` GET (serve + signed URL) | session (`getFile`, `files.ts:316`) | `files_select` RLS | No IDOR — cross-tenant id → null → 404 |
| `files/[id]` PATCH (classify) | session (`classifyFile`, `files.ts:342`) | `files_update` RLS | Scoped |
| `files/[id]` DELETE | admin | **explicit** `isUploader \|\| (isAdmin && sameCompany)` + affected-row verify (`:168-192`) | Sound (2026-06-26 audit fix) |
| `files/[id]/access` GET (list grants) | admin | **explicit** uploader-or-admin+sameCompany (`:49-56`) | Sound |
| `files/[id]/access` POST/DELETE (grant/revoke) | session | `file_access_grants` INSERT/DELETE RLS (`0065:61-97`): `files.uploader_id = auth.uid()` OR CEO/COO/admin where `company_id = files.company_id` | No priv-esc, no cross-tenant grant |
| `createFile` — agent upload | session | RLS verifies `uploader_id = auth.uid()` | Sound |
| `createFile` — customer_widget upload | admin (uploader is null → RLS would reject) | `company_id = conv.companyId`, and `conv` is resolved from the server-validated `x-care-session` token with `conv.id === [id]` enforced (`care/conversations/[id]/upload/route.ts:51-52,112`) | No cross-tenant write — the tenant is the token's conversation's company, not a client field |

## Notes
- The `file_access_grants` SELECT policy is grantee-only (`0063`) — that's why the owner-facing "list
  grants" view routes through the admin-client GET with its explicit check, an intentionally STRONGER
  authorization than the old membership-based RLS. Correct.
- The widget upload path also block-lists dangerous extensions (`validateUploadCandidate` with `filename`,
  Audit F2 / 2026-07-09) since the browser MIME is spoofable — defense-in-depth, already wired.
- No UPDATE policy on `file_access_grants` (rows immutable). Consistent with the append-only posture.

## Verdict
No IDOR (RLS-scoped reads), no privilege escalation (grant writes require uploader-or-company-admin), no
cross-tenant read or write. The admin-client uses are all either explicit-check-gated or system-INSERTs
with a server-derived company. **Sound.**
